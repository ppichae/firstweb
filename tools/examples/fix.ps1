# 검토하며 고친 내용(대상 id별 바꿀 칸)을 예문 자료에 반영한다
param([string]$File, [string]$Fix)
$utf8 = New-Object Text.UTF8Encoding $false
$doc = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8) | ConvertFrom-Json
$fixes = [IO.File]::ReadAllText($Fix, [Text.Encoding]::UTF8) | ConvertFrom-Json
$n = 0
foreach ($f in $fixes) {
  $it = $doc.items | Where-Object { $_.target -eq $f.target } | Select-Object -First 1
  if (-not $it) { "없는 대상: " + $f.target; continue }
  foreach ($p in $f.PSObject.Properties) { if ($p.Name -ne "target") { $it | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value -Force; $n++ } }
}
$lines = $doc.items | ForEach-Object { "    " + ($_ | ConvertTo-Json -Compress -Depth 5) }
$out = "{`n  `"meta`": " + ($doc.meta | ConvertTo-Json -Compress -Depth 5) + ",`n  `"items`": [`n" + ($lines -join ",`n") + "`n  ]`n}`n"
[IO.File]::WriteAllText($File, $out, $utf8)
"고친 칸 " + $n + "개"