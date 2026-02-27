$targetDir = "C:\Users\Balaraman\.gemini\antigravity\scratch\JARVIS\core"

# Use a case-sensitive hash table
$replacements = New-Object System.Collections.Specialized.OrderedDictionary
$replacements.Add("OPEN-CLAW", "JARVIS")
$replacements.Add("OPENCLAW", "JARVIS")
$replacements.Add("Open-Claw", "JARVIS")
$replacements.Add("OpenClaw", "JARVIS")
$replacements.Add("openClaw", "jarvis")
$replacements.Add("openclaw", "jarvis")
$replacements.Add("Openclaw", "Jarvis")
$replacements.Add("open-claw", "jarvis")

# 1. Replace content in files
Get-ChildItem -Path $targetDir -Recurse -File -Exclude ".git", "*.png", "*.jpg", "*.jpeg", "*.gif", "*.ico", "*.pdf", "*.zip", "pnpm-lock.yaml" | ForEach-Object {
    $file = $_.FullName
    Write-Host "Processing file: $file"
    $content = Get-Content -Path $file -Raw
    $originalContent = $content
    
    foreach ($search in $replacements.Keys) {
        $replace = $replacements[$search]
        # Use case-sensitive replacement for specific cases if needed, but here simple -replace is often case-insensitive.
        # Let's use regex with case sensitivity.
        $content = [regex]::Replace($content, [regex]::Escape($search), $replace)
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "Updated content in: $file"
    }
}

# 2. Rename files and directories
# We do this in two passes: files first, then directories (bottom-up)
Get-ChildItem -Path $targetDir -Recurse | Sort-Object FullName -Descending | ForEach-Object {
    $oldName = $_.Name
    $newName = $oldName
    
    foreach ($search in $replacements.Keys) {
        $replace = $replacements[$search]
        if ($oldName -like "*$search*") {
             $newName = $oldName -replace [regex]::Escape($search), $replace
        }
    }
    
    if ($newName -ne $oldName) {
        $newPath = Join-Path $_.Parent.FullName $newName
        Rename-Item -Path $_.FullName -NewName $newName
        Write-Host "Renamed: $($_.FullName) -> $newPath"
    }
}
