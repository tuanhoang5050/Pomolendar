const fs = require('fs');
const path = require('path');

// Tên file đầu ra
const outputFile = path.join(__dirname, 'tat_ca_code_he_thong.txt');
// Các thư mục bạn muốn quét code (ví dụ: src, components, constants...)
const targetDirs = ['./src', './components', './constants', './screens']; 
// Các đuôi file bạn muốn lấy code
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py']; 

// Xóa file cũ nếu đã tồn tại để ghi mới
if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Bỏ qua thư mục node_modules, .git, .expo
      if (!file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(fullPath);
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        const relativePath = path.relative(__dirname, fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Ghi tiêu đề file và nội dung vào file tổng
        fs.appendFileSync(outputFile, `\n\n/* ==================== FILE: ${relativePath} ==================== */\n\n`);
        fs.appendFileSync(outputFile, content);
      }
    }
  });
}

// Chạy quét các thư mục được chỉ định
targetDirs.forEach(dir => scanDirectory(path.join(__dirname, dir)));
// Hoặc nếu bạn muốn quét toàn bộ thư mục gốc, hãy đổi targetDirs thành ['./']

console.log(`🎉 Thành công! Tất cả code đã được xuất ra file: ${outputFile}`);
