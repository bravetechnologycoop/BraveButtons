; Created 2022-07
; by Peter Scholtens and Kerry Wang
; Instructions can be found here: https://app.clickup.com/2434616/v/dc/2a9hr-2261/2a9hr-6207
; The instructions for compiling are at the bottom of the page

#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
name := "REPLACENAME"
counter := 4444

Clear() {
    SendInput ^a
    SendInput {delete}
}

PressOpenPort() {
    MouseClick, left, 513, 68
}

PressTxtBox() {
    MouseCLick, left, 284, 934
}

PressEnter() {
    MouseCLick, left, 1285, 940
}

PressEui() {
    MouseClick, left, 162, 308
}

PressScrollUp() {
    MouseClick, left, 1315, 131
}

ClickAwsAddDevice() {
    MouseClick, left, 1660, 440
}


; Command to set heartbeat and get DEVEUI
!^+a::
Sleep, 500
Run, C:\Users\dev\OneDrive\Desktop\RAK_SERIAL_PORT_TOOL_V1.2.1\RAK_SERIAL_PORT_TOOL_V1.2.1.exe
Sleep, 500
SendInput #{Up}
Sleep, 500

; in-app commands
PressOpenPort()
Sleep, 500

; set heartbeat
PressTxtBox()
Sleep, 500
Clear()
Sleep, 500
SendInput at{+}heartbeat=1
Sleep, 500
PressEnter()
Sleep, 500

; check status
PressTxtBox()
Sleep, 500
Clear()
Sleep, 500
SendInput at{+}get_config=lora:status
Sleep, 500
PressEnter()
Sleep, 500
PressEui()
PressEui()
SendInput ^c
Sleep, 500

; google sheets paste eui
WinActivate, ahk_exe chrome.exe
Sleep, 500
SendInput ^v
Sleep, 500
SendInput {Enter}
SendInput {Enter}
Sleep, 500

; check interval change
WinActivate, ahk_exe RAK_SERIAL_PORT_TOOL_V1.2.1.exe
Sleep, 500
PressTxtBox()
Sleep, 500
Clear()
Sleep, 500
SendInput at{+}get_config=device:status
Sleep, 500
PressEnter()
Sleep, 500

; exit config mode
PressTxtBox()
Sleep, 500
Clear()
Sleep, 500
SendInput at{+}set_config=device:restart
Sleep, 500
PressEnter()
Sleep, 500

loop 9 {
    PressScrollUp() ; check that heartbeat interval is now 1hr
    Sleep, 1
}
Return


; Command to add button from csv to AWS IoT
!^+d::
Sleep, 1000
ClickAwsAddDevice()
Sleep, 1000
SendInput {Tab}{Tab}{Tab}{Tab}{Tab}{Tab}{Enter}{Enter}
Sleep, 1000
SendInput ^1
Sleep, 1000
SendInput ^c
Sleep, 1000
SendInput {Down}
Sleep, 1000
SendInput ^2
Sleep, 1000
Loop 4 {
SendInput {Tab}
SendInput ^v
}
SendInput {Tab}{Tab}{Tab}
SendInput %name%
SendInput _
SendInput, %counter%
counter++
SendInput, %A_Space%
Sleep, 1000
SendInput ^v
SendInput +{Tab}+{Tab}+{Tab}+{Tab}
Sleep, 1000
SendInput {Right}
SendInput AC1F09FFF9157201
Sleep, 1000
SendInput {Tab}{Right}
SendInput AC1F09FFF9157201
Sleep, 1000
SendInput {Tab}
SendInput AC1F09FFF9157201
Sleep, 1000
SendInput {Tab}
SendInput AC1F09FFF9157201
Sleep, 1000
SendInput {Tab}{Tab}{Tab}{Tab}{Tab}
SendInput {Enter}{Enter}{Tab}{Enter}{Enter}{Tab}{Tab}{Enter}{Enter}{Tab}{Tab}{Enter}
Sleep, 1000
SendInput {Enter}   
Return


; Setup for "Command to add button from csv to AWS IoT"
!^+f::
InputBox, name, Client Name (e.g. button), Please enter client name (e.g. CIPTO), , 640, 480
if ErrorLevel
    MsgBox, CANCEL was pressed.
else
    MsgBox, You entered "%name%"
InputBox, counter, Start Counter, the first counter number (i.e. 1), , 640, 480
if ErrorLevel
    MsgBox, CANCEL was pressed.
else
    MsgBox, You entered "%counter%, buttons will be named starting from %name%_%counter%"
Return


; Emergency suspend script
Esc::
Suspend
Pause,, 1
Return