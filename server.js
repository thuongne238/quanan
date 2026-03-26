import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AlwaysData sẽ tự động cấp phát PORT thông qua biến môi trường
const PORT = process.env.PORT || 8080;

app.use(express.json());

// --- CÁC API BACKEND CỦA BẠN SẼ NẰM Ở ĐÂY ---
// Ví dụ:
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Xin chào từ Backend!' });
});
// ------------------------------------------

// 1. Phục vụ các file tĩnh trong thư mục "dist" của giao diện React (Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Load giao diện React cho mọi đường dẫn không phải là API (Quan trọng cho React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại port ${PORT}`);
});
