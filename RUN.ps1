# 🛍️ TechMart E-Commerce Platform - Zero-Dependency Node.js Server Quick Start

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $ScriptDir

$Host.UI.RawUI.WindowTitle = "TechMart E-Commerce Server"
Clear-Host

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "🛍️ TechMart E-Commerce Platform" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🚀 Starting Server..." -ForegroundColor Green
Write-Host ""

node server.js
