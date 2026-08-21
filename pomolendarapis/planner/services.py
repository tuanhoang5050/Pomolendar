import datetime
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from .models import Task, FixedEvent


def get_free_slots(user, start_dt, end_dt):
    free_slots = []
    current_day = start_dt.date()
    end_day = end_dt.date()

    busy_periods = []
    events = FixedEvent.objects.filter(
        user=user,
        end_time__gt=start_dt,
        start_time__lt=end_dt,
        active=True
    )
    tasks = Task.objects.filter(
        user=user,
        scheduled_end_time__gt=start_dt,
        scheduled_start_time__lt=end_dt
    )

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
        day_start = timezone.make_aware(datetime.datetime.combine(day, datetime.time(7, 0)))
        day_end = timezone.make_aware(datetime.datetime.combine(day, datetime.time(23, 0)))

        if i == 0 and start_dt > day_start:
            day_start = start_dt

        current_pointer = day_start

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

    return [s for s in free_slots if (s[1] - s[0]).total_seconds() >= 900]


def calculate_heuristic_score(task, now):
    priority_value = task.priority if task.priority else 4
    p_score = 5 - priority_value

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

    return (p_score * 10) + d_score


def generate_user_schedule(user):
    now = timezone.localtime()
    end_horizon = (now + timedelta(days=6)).replace(hour=23, minute=59, second=59)

    unscheduled_tasks = list(Task.objects.filter(
        user=user,
        is_completed=False,
        scheduled_start_time__isnull=True
    ))

    if not unscheduled_tasks:
        return True

    unscheduled_tasks.sort(key=lambda t: calculate_heuristic_score(t, now), reverse=True)
    free_slots = get_free_slots(user, now, end_horizon)

    tasks_to_update = []

    while unscheduled_tasks:
        task = unscheduled_tasks.pop(0)
        scheduled = False

        for i, slot in enumerate(free_slots):
            slot_start, slot_end = slot
            slot_duration = (slot_end - slot_start).total_seconds() / 60.0

            n_pomo = task.estimated_pomodoros or 1
            f_dur = task.focus_duration or 25
            b_dur = task.short_break or 5

            total_needed = (n_pomo * f_dur) + ((n_pomo - 1) * b_dur) if n_pomo > 1 else f_dur

            if total_needed <= slot_duration:
                task.scheduled_start_time = slot_start
                task.scheduled_end_time = slot_start + timedelta(minutes=total_needed)
                tasks_to_update.append(task)

                free_slots[i] = (task.scheduled_end_time, slot_end)
                scheduled = True
                break
            else:
                min_f = max(15, f_dur - 5)
                min_b = max(2, b_dur - 3)
                min_needed = (n_pomo * min_f) + ((n_pomo - 1) * min_b) if n_pomo > 1 else min_f

                if min_needed <= slot_duration:
                    task.focus_duration = min_f
                    task.short_break = min_b
                    task.scheduled_start_time = slot_start
                    task.scheduled_end_time = slot_start + timedelta(minutes=min_needed)
                    tasks_to_update.append(task)

                    free_slots[i] = (task.scheduled_end_time, slot_end)
                    scheduled = True
                    break
                else:
                    k = int((slot_duration + b_dur) / (f_dur + b_dur))

                    if k >= 1 and k < n_pomo:
                        time_for_k = (k * f_dur) + ((k - 1) * b_dur)
                        task.estimated_pomodoros = k
                        task.scheduled_start_time = slot_start
                        task.scheduled_end_time = slot_start + timedelta(minutes=time_for_k)
                        tasks_to_update.append(task)

                        free_slots[i] = (task.scheduled_end_time, slot_end)

                        remain_pomo = n_pomo - k
                        new_task = Task.objects.create(
                            user=task.user,
                            title=f"{task.title} expand",
                            description=task.description,
                            estimated_pomodoros=remain_pomo,
                            focus_duration=f_dur,
                            short_break=b_dur,
                            priority=task.priority,
                            deadline=task.deadline
                        )

                        unscheduled_tasks.append(new_task)
                        unscheduled_tasks.sort(key=lambda t: calculate_heuristic_score(t, now), reverse=True)

                        scheduled = True
                        break

    if tasks_to_update:
        Task.objects.bulk_update(
            tasks_to_update,
            ['scheduled_start_time', 'scheduled_end_time', 'estimated_pomodoros', 'focus_duration', 'short_break']
        )

    return True