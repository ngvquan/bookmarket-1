# Android: chatbot and voice search on local Wi-Fi

The Android APK uses the hosted Render API for shopping. The chatbot and voice search use the computer's LAN address set in `frontend/.env.mobile` (`VITE_AI_URL` and `VITE_VOICE_URL`). Currently this is `192.168.1.211`.

1. Connect the phone and computer to the same Wi-Fi.
2. Run `powershell -ExecutionPolicy Bypass -File scripts/start-mobile-ai-voice.ps1` from the project root. Keep the computer and Ollama running.
3. Install the debug APK, open BookMarket and allow microphone access when Android asks.

If the computer's LAN IP changes, update both URLs in `frontend/.env.mobile`, then run `npm run build:mobile`, `npm run cap:sync`, and `gradlew.bat assembleDebug` again. Local HTTP access is enabled in the Android debug build for these LAN services.

The emulator test verified an Ollama response and an audio upload to the voice server. The emulator did not provide spoken input, so recognition of a person speaking on a physical phone still needs a device check.
