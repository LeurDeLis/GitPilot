!ifndef BUILD_UNINSTALLER
  !include "MUI2.nsh"
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"

  Var DesktopShortcutCheckbox
  Var CreateDesktopShortcut

  LangString desktopShortcutPageTitle 2052 "其他任务"
  LangString desktopShortcutPageTitle 1033 "Additional tasks"
  LangString desktopShortcutPageSubtitle 2052 "选择安装 GitPilot 时要执行的其他任务。"
  LangString desktopShortcutPageSubtitle 1033 "Choose the additional tasks to perform while installing GitPilot."
  LangString desktopShortcutOption 2052 "创建桌面快捷方式"
  LangString desktopShortcutOption 1033 "Create a desktop shortcut"

  !macro customInit
    StrCpy $CreateDesktopShortcut "1"
  !macroend

  !macro customPageAfterChangeDir
    Page custom DesktopShortcutPageCreate DesktopShortcutPageLeave
  !macroend

  Function DesktopShortcutPageCreate
    !insertmacro MUI_HEADER_TEXT "$(desktopShortcutPageTitle)" "$(desktopShortcutPageSubtitle)"

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 12u 100% 12u "$(desktopShortcutOption)"
    Pop $DesktopShortcutCheckbox
    ${NSD_Check} $DesktopShortcutCheckbox

    nsDialogs::Show
  FunctionEnd

  Function DesktopShortcutPageLeave
    ${NSD_GetState} $DesktopShortcutCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $CreateDesktopShortcut "1"
    ${Else}
      StrCpy $CreateDesktopShortcut "0"
    ${EndIf}
  FunctionEnd

  !macro customInstall
    ${IfNot} ${Silent}
      ${If} $CreateDesktopShortcut == "1"
        CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
        WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
      ${Else}
        WinShell::UninstShortcut "$newDesktopLink"
        Delete "$newDesktopLink"
      ${EndIf}
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${EndIf}
  !macroend
!endif
