# TechMart E-Commerce Platform (PHP Backend)

## Prerequisites:
- **PHP 7.4 or higher** with SQLite extension enabled
- Web browser

### Installing PHP on Windows:
1. Download PHP from: https://windows.php.net/download/
2. Choose the **"VS16 x64 Thread Safe"** version (latest stable)
3. Extract to `C:\php` (or any folder)
4. Add PHP to your system PATH:
   - Search for "Environment Variables"
   - Edit "Path" variable
   - Add `C:\php` (or your PHP folder)
5. Restart your command prompt/PowerShell
6. Test with: `php --version`

## Simple PHP Backend Setup

### To Start the Backend:
1. Double-click `RUN.bat` (Windows) or run `RUN.ps1` (PowerShell)
2. Choose option 1: "Start PHP Server"
3. Backend will run on http://localhost:8000

### Manual Start:
```bash
php -S localhost:8000 index.php
```

### Seed Database:
```bash
php seed.php
```

### Admin Credentials:
- Username: admin
- Password: admin123

### API Endpoints:
- Frontend: http://localhost:8000
- API: http://localhost:8000/api

The backend is now running on pure PHP with SQLite database.