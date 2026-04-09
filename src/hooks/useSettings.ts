import { useState } from 'react'
import { api } from '../api'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import type { Settings } from '../types'

export function useSettings(setPeriodOffset: (offset: number) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsDraft, setSettingsDraft] = useState<Settings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Called by App's openSettings (after closeOverlays)
  const openSettingsModal = (current: Settings) => {
    setSettingsDraft(current)
    setIsSettingsOpen(true)
  }

  const closeSettings = () => setIsSettingsOpen(false)

  const saveSettings = async () => {
    setSettings(settingsDraft)
    setPeriodOffset(0)
    try {
      await api.saveSettings(settingsDraft)
    } catch (error) {
      console.error('Failed to save settings', error)
    }
    closeSettings()
  }

  return {
    settings,
    setSettings,
    settingsDraft,
    setSettingsDraft,
    isSettingsOpen,
    openSettingsModal,
    closeSettings,
    saveSettings,
  }
}
