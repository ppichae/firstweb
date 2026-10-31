# 묶음 파일(예문 배열)을 예문 자료 파일에 덧붙인다. 같은 대상(target)의 예문이 이미 있으면 덧붙이지 않고 알려 준다.
param([string]$File, [string]$Batch)
$utf8 = New-Object Text.UTF8Encoding $false
$doc = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8) | ConvertFrom-Json
$add = [IO.File]::ReadAllText($Batch, [Text.Encoding]::UTF8) | ConvertFrom-Json
$have = @{}; $doc.items | ForEach-Object { $have[$_.target] = 1 }
$list = New-Object System.Collections.ArrayList; $doc.items | ForEach-Object { [void]$list.Add($_) }
$skipped = @()
foreach ($a in $add) { if ($have.ContainsKey($a.target)) { $skipped += $a.target } else { [void]$list.Add($a); $have[$a.target] = 1 } }
$lines = $list | ForEach-Object { "    " + ($_ | ConvertTo-Json -Compress -Depth 5) }
$out = "{`n  `"meta`": " + ($doc.meta | ConvertTo-Json -Compress -Depth 5) + ",`n  `"items`": [`n" + ($lines -join ",`n") + "`n  ]`n}`n"
[IO.File]::WriteAllText($File, $out, $utf8)
"덧붙임 " + ($add.Count - $skipped.Count) + "개 · 전체 " + $list.Count + "개" + $(if ($skipped.Count) { " · 이미 있어 건너뜀: " + ($skipped -join ",") } else { "" })