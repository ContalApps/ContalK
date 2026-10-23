; Automatic upgrades from older clients also bypass the assisted wizard.
; Manual first-time installs keep the normal directory selection pages.
!macro customInit
  ${if} ${isUpdated}
    ${ifNot} ${Silent}
      InitPluginsDir
      SetOutPath "$PLUGINSDIR"
      File /oname=contalk-update.exe "${BUILD_RESOURCES_DIR}\..\native\bin\contalk-update.exe"
      File /oname=contalk-update-logo.png "${BUILD_RESOURCES_DIR}\..\public\contalk-avatar.png"
      Exec '"$PLUGINSDIR\contalk-update.exe" --wait "Local\ContalKUpdate-Bootstrap" "$PLUGINSDIR\contalk-update-logo.png"'
    ${endIf}
    SetSilent silent
  ${endIf}
!macroend

!macro customInstall
  ${if} ${isUpdated}
    Exec '"$INSTDIR\resources\update\contalk-update.exe" --finish "Local\ContalKUpdate-Bootstrap"'
  ${endIf}
!macroend
