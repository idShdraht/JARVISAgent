package ai.jarvis.android.ui

import androidx.compose.runtime.Composable
import ai.jarvis.android.MainViewModel
import ai.jarvis.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
