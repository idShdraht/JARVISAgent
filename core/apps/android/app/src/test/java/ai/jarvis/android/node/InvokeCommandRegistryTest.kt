package ai.jarvis.android.node

import ai.jarvis.android.protocol.JARVISCameraCommand
import ai.jarvis.android.protocol.JARVISDeviceCommand
import ai.jarvis.android.protocol.JARVISLocationCommand
import ai.jarvis.android.protocol.JARVISNotificationsCommand
import ai.jarvis.android.protocol.JARVISSmsCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        cameraEnabled = false,
        locationEnabled = false,
        smsAvailable = false,
        debugBuild = false,
      )

    assertFalse(commands.contains(JARVISCameraCommand.Snap.rawValue))
    assertFalse(commands.contains(JARVISCameraCommand.Clip.rawValue))
    assertFalse(commands.contains(JARVISCameraCommand.List.rawValue))
    assertFalse(commands.contains(JARVISLocationCommand.Get.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Status.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Info.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Permissions.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Health.rawValue))
    assertTrue(commands.contains(JARVISNotificationsCommand.List.rawValue))
    assertTrue(commands.contains(JARVISNotificationsCommand.Actions.rawValue))
    assertFalse(commands.contains(JARVISSmsCommand.Send.rawValue))
    assertFalse(commands.contains("debug.logs"))
    assertFalse(commands.contains("debug.ed25519"))
    assertTrue(commands.contains("app.update"))
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        cameraEnabled = true,
        locationEnabled = true,
        smsAvailable = true,
        debugBuild = true,
      )

    assertTrue(commands.contains(JARVISCameraCommand.Snap.rawValue))
    assertTrue(commands.contains(JARVISCameraCommand.Clip.rawValue))
    assertTrue(commands.contains(JARVISCameraCommand.List.rawValue))
    assertTrue(commands.contains(JARVISLocationCommand.Get.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Status.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Info.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Permissions.rawValue))
    assertTrue(commands.contains(JARVISDeviceCommand.Health.rawValue))
    assertTrue(commands.contains(JARVISNotificationsCommand.List.rawValue))
    assertTrue(commands.contains(JARVISNotificationsCommand.Actions.rawValue))
    assertTrue(commands.contains(JARVISSmsCommand.Send.rawValue))
    assertTrue(commands.contains("debug.logs"))
    assertTrue(commands.contains("debug.ed25519"))
    assertTrue(commands.contains("app.update"))
  }
}
