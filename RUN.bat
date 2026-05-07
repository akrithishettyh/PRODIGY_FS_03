@echo off
REM 🛍️ TechMart E-Commerce Platform - Zero-Dependency Node.js Server

setlocal enabledelayedexpansion
cd /d "%~dp0"

title TechMart E-Commerce Server
color 0A
cls

echo.
echo ================================
echo 🛍️ TechMart E-Commerce Platform
echo ================================
echo.

echo 🚀 Starting Server...
echo.
echo 🌐 The app will open in your browser automatically...
echo.

REM Start the server using native Node.js
node server.js
