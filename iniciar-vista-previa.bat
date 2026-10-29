@echo off
title Huerta Inteligente ENGINE - Servidor Local
set "PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"
echo Iniciando servidor de desarrollo Vite para Huerta Inteligente ENGINE...
npm run dev -- --open
pause
