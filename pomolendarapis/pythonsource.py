import os

# 1. Định nghĩa các thư mục và file muốn BỎ QUA (Tránh gom file rác, file thư viện)
EXCLUDE_DIRS = {
    '.git', '.venv', 'venv', 'env', '__pycache__',
    'migrations', '.idea', '.vscode', 'static', 'media'
}
EXCLUDE_FILES = {
    'export_project_code.py', 'package-lock.json', '.gitignore',
    'db.sqlite3', '.env'
}

# 2. Định nghĩa các định dạng file chứa code bạn muốn GOM LẠI
ALLOWED_EXTENSIONS = {'.py', '.html', '.css', '.js'}

# Tên file đầu ra sẽ chứa toàn bộ code của bạn
OUTPUT_FILE = 'all_project_code_backup.py'


def export_code():
    project_root = os.path.dirname(os.path.abspath(__file__))

    with open(os.path.join(project_root, OUTPUT_FILE), 'w', encoding='utf-8') as output:
        output.write(f'# ==========================================\n')
        output.write(f'# BẢN SAO LƯU TOÀN BỘ MÃ NGUỒN DỰ ÁN\n')
        output.write(f'# Thư mục gốc: {project_root}\n')
        output.write(f'# ==========================================\n\n')

        # Duyệt qua toàn bộ cây thư mục trong dự án
        for root, dirs, files in os.walk(project_root):
            # Loại bỏ các thư mục ẩn hoặc thư mục rác khỏi danh sách duyệt
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]

            for file in files:
                if file in EXCLUDE_FILES or file.startswith('.'):
                    continue

                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, project_root)
                _, ext = os.path.splitext(file.lower())

                # Chỉ xử lý các file có đuôi mở rộng nằm trong danh sách cho phép
                if ext in ALLOWED_EXTENSIONS:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        # Viết tiêu đề đánh dấu tên file để dễ đọc
                        output.write(f'\n# {"=" * 60}\n')
                        output.write(f'# FILE: {relative_path}\n')
                        output.write(f'# {"=" * 60}\n\n')

                        output.write(content)
                        output.write('\n\n')
                        print(f'✅ Đã gom code file: {relative_path}')

                    except Exception as e:
                        print(f'❌ Không thể đọc file {relative_path}: {e}')

    print(f'\n🎉 HOÀN THÀNH! Toàn bộ code đã được lưu vào file: {OUTPUT_FILE}')


if __name__ == '__main__':
    export_code()
