# Komorebi Config

This folder contains the Windows tiling setup translated from the author's Hyprland config.

## Files

- `komorebi.json`: Komorebi layout, workspace, animation, gap, and border settings
- `komorebi.ahk`: AutoHotkey v2 keybinds that mirror the Hyprland shortcuts as closely as Windows allows

## Requirements

- Komorebi installed to `C:\Program Files\komorebi\bin`
- AutoHotkey v2 installed to `C:\Program Files\AutoHotkey\v2`
- PowerToys Run enabled with `Alt+Space`

## Setup

Copy the files into your profile:

```powershell
Copy-Item .\configs\komorebi\komorebi.json "$env:USERPROFILE\komorebi.json" -Force
Copy-Item .\configs\komorebi\komorebi.ahk "$env:USERPROFILE\komorebi.ahk" -Force
```

Start Komorebi and the hotkeys:

```powershell
& 'C:\Program Files\komorebi\bin\komorebic.exe' start -c "$env:USERPROFILE\komorebi.json"
& 'C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe' "$env:USERPROFILE\komorebi.ahk"
```

## Autostart

Set user login startup entries:

```powershell
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Set-ItemProperty -Path $runKey -Name 'komorebi' -Value '"C:\Program Files\komorebi\bin\komorebic.exe" start -c "C:\Users\' + $env:USERNAME + '\komorebi.json"'
Set-ItemProperty -Path $runKey -Name 'komorebi-ahk' -Value '"C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe" "C:\Users\' + $env:USERNAME + '\komorebi.ahk"'
```

## Notes

- `Win+Space` forwards to `Alt+Space` to open PowerToys Run.
- `Win+Shift+L` is used for sleep instead of `Win+L`, because Windows reserves `Win+L` for lock.
- `Win+N` is currently a placeholder for a night light toggle.
