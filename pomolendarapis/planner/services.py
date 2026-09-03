import datetime
import heapq
import re
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from .models import Task, FixedEvent

SCHEDULE_HORIZON_DAYS = 6
MIN_SLOT_MINUTES = 15
DEFAULT_SPREAD_DAILY_LIMIT_MINUTES = 240


def get_free_slots(user, start_dt, end_dt, preferred_time="any"):
    free_slots = []
    current_day = start_dt.date()
    end_day = end_dt.date()

    if preferred_time == "morning":
        work_start, work_end = 7, 12
    elif preferred_time == "afternoon":
        work_start, work_end = 13, 18
    elif preferred_time == "evening":
        work_start, work_end = 19, 23
    else:  # "any"
        work_start, work_end = 7, 23

    busy_periods = []
    events = FixedEvent.objects.filter(user=user, end_time__gt=start_dt, start_time__lt=end_dt, active=True)
    tasks = Task.objects.filter(user=user, is_completed=False, scheduled_end_time__gt=start_dt,
                                scheduled_start_time__lt=end_dt)

    for e in events:
        busy_periods.append((e.start_time, e.end_time))
    for t in tasks:
        busy_periods.append((t.scheduled_start_time, t.scheduled_end_time))

    busy_periods.sort(key=lambda x: x[0])
    merged_busy = []

    if busy_periods:
        current_start, current_end = busy_periods[0]
        for start, end in busy_periods[1:]:
            if start <= current_end:
                current_end = max(current_end, end)
            else:
                merged_busy.append((current_start, current_end))
                current_start, current_end = start, end
        merged_busy.append((current_start, current_end))

    for i in range((end_day - current_day).days + 1):
        day = current_day + timedelta(days=i)
        day_start = timezone.make_aware(datetime.datetime.combine(day, datetime.time(work_start, 0)))
        day_end = timezone.make_aware(datetime.datetime.combine(day, datetime.time(work_end, 0)))

        if i == 0 and start_dt > day_start:
            day_start = start_dt

        current_pointer = max(day_start, start_dt)

        for b_start, b_end in merged_busy:
            if b_end <= current_pointer:
                continue
            if b_start >= day_end:
                break

            if b_start > current_pointer:
                free_slots.append((current_pointer, b_start))

            current_pointer = max(current_pointer, b_end)

        if current_pointer < day_end:
            free_slots.append((current_pointer, day_end))

    return [s for s in free_slots if (s[1] - s[0]).total_seconds() >= MIN_SLOT_MINUTES * 60]


def calculate_heuristic_score(task, now, priority_strategy="balanced"):
    p_score = task.priority if task.priority else 2

    d_score = 0
    if task.deadline:
        days_left = (task.deadline - now).total_seconds() / 86400.0
        if days_left < 0:
            d_score = 100
        elif days_left <= 1:
            d_score = 50
        elif days_left <= 3:
            d_score = 30
        elif days_left <= 7:
            d_score = 10

    if priority_strategy == "deadline":
        return (p_score * 2) + (d_score * 20)
    elif priority_strategy == "importance":
        complexity = task.estimated_pomodoros or 1
        return (p_score * 20) + (complexity * 5) + d_score
    else:
        return (p_score * 10) + d_score


def _strip_split_suffix(title):
    return re.sub(r'\s*\(part \d+\)\s*$', '', title).strip()


class TaskItem:
    def __init__(self, score, task):
        self.score = score
        self.task = task

    def __lt__(self, other):
        return self.score > other.score


def generate_user_schedule(
        user,
        priority_strategy="balanced",
        distribution="front_load",
        preferred_time="any",
        pacing="hustle",
        allow_split=True,
        spread_daily_limit_minutes=DEFAULT_SPREAD_DAILY_LIMIT_MINUTES
):
    now = timezone.localtime()
    end_horizon = (now + timedelta(days=SCHEDULE_HORIZON_DAYS)).replace(hour=23, minute=59, second=59)

    unscheduled_tasks_qs = Task.objects.filter(user=user, is_completed=False, scheduled_start_time__isnull=True)
    if not unscheduled_tasks_qs.exists():
        return True, []

    task_queue = []
    for t in unscheduled_tasks_qs:
        score = calculate_heuristic_score(t, now, priority_strategy)
        heapq.heappush(task_queue, TaskItem(score, t))

    free_slots = get_free_slots(user, now, end_horizon, preferred_time)

    tasks_to_update = []
    split_counters = {}
    unfittable_tasks = []
    daily_minutes_assigned = {}

    task_buffer_minutes = 30 if pacing == "chill" else 10

    with transaction.atomic():
        while task_queue:
            task_item = heapq.heappop(task_queue)
            task = task_item.task
            scheduled = False

            task_deadline = task.deadline if (task.deadline and task.deadline > now) else None

            for i, slot in enumerate(free_slots):
                slot_start, real_slot_end = slot

                if task_deadline and slot_start >= task_deadline:
                    continue

                slot_end = min(real_slot_end, task_deadline) if task_deadline else real_slot_end
                slot_duration = (slot_end - slot_start).total_seconds() / 60.0
                if slot_duration < MIN_SLOT_MINUTES:
                    continue

                slot_date = slot_start.date()

                if distribution == "spread":
                    current_daily_load = daily_minutes_assigned.get(slot_date, 0)
                    if current_daily_load >= spread_daily_limit_minutes:
                        continue

                n_pomo = task.estimated_pomodoros or 1
                f_dur = task.focus_duration or 25
                b_dur = task.short_break or 5

                total_needed = (n_pomo * f_dur) + ((n_pomo - 1) * b_dur) if n_pomo > 1 else f_dur

                if total_needed <= slot_duration:
                    task.scheduled_start_time = slot_start
                    task.scheduled_end_time = slot_start + timedelta(minutes=total_needed)
                    tasks_to_update.append(task)

                    next_start = task.scheduled_end_time + timedelta(minutes=task_buffer_minutes)
                    if (real_slot_end - next_start).total_seconds() >= MIN_SLOT_MINUTES * 60:
                        free_slots[i] = (next_start, real_slot_end)
                    else:
                        free_slots[i] = (real_slot_end, real_slot_end)

                    daily_minutes_assigned[slot_date] = daily_minutes_assigned.get(slot_date, 0) + total_needed
                    scheduled = True
                    break

                else:
                    min_f = max(15, f_dur - 5) if pacing == "hustle" else f_dur
                    min_b = max(2, b_dur - 3) if pacing == "hustle" else b_dur
                    min_needed = (n_pomo * min_f) + ((n_pomo - 1) * min_b) if n_pomo > 1 else min_f

                    if min_needed < total_needed and min_needed <= slot_duration:
                        task.focus_duration = min_f
                        task.short_break = min_b
                        task.scheduled_start_time = slot_start
                        task.scheduled_end_time = slot_start + timedelta(minutes=min_needed)
                        tasks_to_update.append(task)

                        next_start = task.scheduled_end_time + timedelta(minutes=task_buffer_minutes)
                        if (real_slot_end - next_start).total_seconds() >= MIN_SLOT_MINUTES * 60:
                            free_slots[i] = (next_start, real_slot_end)
                        else:
                            free_slots[i] = (real_slot_end, real_slot_end)

                        daily_minutes_assigned[slot_date] = daily_minutes_assigned.get(slot_date, 0) + min_needed
                        scheduled = True
                        break

                    elif allow_split:
                        k = int((slot_duration + b_dur) / (f_dur + b_dur))
                        if k >= 1 and k < n_pomo:
                            time_for_k = (k * f_dur) + ((k - 1) * b_dur)
                            task.estimated_pomodoros = k
                            task.scheduled_start_time = slot_start
                            task.scheduled_end_time = slot_start + timedelta(minutes=time_for_k)
                            tasks_to_update.append(task)

                            next_start = task.scheduled_end_time + timedelta(minutes=task_buffer_minutes)
                            if (real_slot_end - next_start).total_seconds() >= MIN_SLOT_MINUTES * 60:
                                free_slots[i] = (next_start, real_slot_end)
                            else:
                                free_slots[i] = (real_slot_end, real_slot_end)

                            daily_minutes_assigned[slot_date] = daily_minutes_assigned.get(slot_date, 0) + time_for_k

                            remain_pomo = n_pomo - k

                            remaining_minutes = (remain_pomo * f_dur) + (
                                        (remain_pomo - 1) * b_dur) if remain_pomo > 1 else f_dur

                            if remaining_minutes >= 15:
                                base_title = _strip_split_suffix(task.title)
                                split_counters[base_title] = split_counters.get(base_title, 1) + 1
                                part_number = split_counters[base_title]

                                new_task = Task.objects.create(
                                    user=task.user,
                                    title=f"{base_title} (part {part_number})",
                                    description=task.description,
                                    estimated_pomodoros=remain_pomo,
                                    focus_duration=f_dur,
                                    short_break=b_dur,
                                    priority=task.priority,
                                    deadline=task.deadline
                                )

                                new_score = calculate_heuristic_score(new_task, now, priority_strategy)
                                heapq.heappush(task_queue, TaskItem(new_score, new_task))

                            scheduled = True
                            break

            if not scheduled:
                unfittable_tasks.append(task)

        if tasks_to_update:
            Task.objects.bulk_update(
                tasks_to_update,
                ['scheduled_start_time', 'scheduled_end_time', 'estimated_pomodoros', 'focus_duration', 'short_break']
            )

    return True, unfittable_tasks