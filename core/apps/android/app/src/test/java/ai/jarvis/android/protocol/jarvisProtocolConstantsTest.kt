package ai.jarvis.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class JARVISProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", JARVISCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", JARVISCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", JARVISCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", JARVISCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", JARVISCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", JARVISCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", JARVISCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", JARVISCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", JARVISCapability.Canvas.rawValue)
    assertEquals("camera", JARVISCapability.Camera.rawValue)
    assertEquals("screen", JARVISCapability.Screen.rawValue)
    assertEquals("voiceWake", JARVISCapability.VoiceWake.rawValue)
    assertEquals("location", JARVISCapability.Location.rawValue)
    assertEquals("sms", JARVISCapability.Sms.rawValue)
    assertEquals("device", JARVISCapability.Device.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", JARVISCameraCommand.List.rawValue)
    assertEquals("camera.snap", JARVISCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", JARVISCameraCommand.Clip.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", JARVISScreenCommand.Record.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", JARVISNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", JARVISNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", JARVISDeviceCommand.Status.rawValue)
    assertEquals("device.info", JARVISDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", JARVISDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", JARVISDeviceCommand.Health.rawValue)
  }
}
