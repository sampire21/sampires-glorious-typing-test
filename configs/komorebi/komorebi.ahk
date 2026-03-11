#Requires AutoHotkey v2.0
#SingleInstance Force

A_MenuMaskKey := "vkE8"

terminal := "wt.exe"
fileManager := "explorer.exe"
browserPath := EnvGet("ProgramFiles") "\BraveSoftware\Brave-Browser\Application\brave.exe"
komorebicPath := "C:\Program Files\komorebi\bin\komorebic.exe"

Komorebic(args) {
    global komorebicPath
    try RunWait('"' komorebicPath '" ' args, , "Hide")
}

RunIfExists(path, fallback := "") {
    if path != "" && FileExist(path) {
        Run(path)
        return
    }

    if fallback != "" {
        Run(fallback)
    }
}

SleepComputer() {
    try DllCall("PowrProf\SetSuspendState", "Int", 0, "Int", 0, "Int", 0)
}

ToggleNightLight() {
    ; Add a Windows-compatible night light toggle tool here if needed.
}

LaunchMenu() {
    Send("!{Space}")
}

Komorebic("mouse-follows-focus enable")

#q::Run(terminal)
#e::Run(fileManager)
#Space::LaunchMenu()
#PrintScreen::Run("explorer.exe ms-screenclip:")

#c::Komorebic("close")
#f::Komorebic("toggle-monocle")
#v::Komorebic("toggle-float")
#p::Komorebic("toggle-window-container-behaviour")
#j::Komorebic("flip-layout horizontal")

#+m::Komorebic("stop")
#+l::SleepComputer()
#n::ToggleNightLight()
#+b::Run("taskkill.exe /IM komorebi-bar.exe /F")

#Left::Komorebic("focus left")
#Right::Komorebic("focus right")
#Up::Komorebic("focus up")
#Down::Komorebic("focus down")

#+Left::Komorebic("move left")
#+Right::Komorebic("move right")
#+Up::Komorebic("move up")
#+Down::Komorebic("move down")

#1::Komorebic("focus-workspace 0")
#2::Komorebic("focus-workspace 1")
#3::Komorebic("focus-workspace 2")
#4::Komorebic("focus-workspace 3")
#5::Komorebic("focus-workspace 4")
#6::Komorebic("focus-workspace 5")
#7::Komorebic("focus-workspace 6")
#8::Komorebic("focus-workspace 7")
#9::Komorebic("focus-workspace 8")
#0::Komorebic("focus-workspace 9")

#+1::Komorebic("move-to-workspace 0")
#+2::Komorebic("move-to-workspace 1")
#+3::Komorebic("move-to-workspace 2")
#+4::Komorebic("move-to-workspace 3")
#+5::Komorebic("move-to-workspace 4")
#+6::Komorebic("move-to-workspace 5")
#+7::Komorebic("move-to-workspace 6")
#+8::Komorebic("move-to-workspace 7")
#+9::Komorebic("move-to-workspace 8")
#+0::Komorebic("move-to-workspace 9")

#WheelDown::Komorebic("cycle-workspace next")
#WheelUp::Komorebic("cycle-workspace previous")

#!o::RunIfExists(browserPath, "brave.exe")
