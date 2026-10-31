# 기존 예문 되돌리기: 원본 파일에 있던 예문(앞쪽 N개)을 원본 그대로 되돌리고, 새로 더한 예문은 그대로 둔다
param([string]$File, [string]$Orig)
$utf8 = New-Object Text.UTF8Encoding $false
$cur = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8) | ConvertFrom-Json
$org = [IO.File]::ReadAllText($Orig, [Text.Encoding]::UTF8) | ConvertFrom-Json
$list = New-Object System.Collections.ArrayList
$fixed = 0
for ($i = 0; $i -lt $cur.items.Count; $i++) {
  if ($i -lt $org.items.Count) {
    if ($cur.items[$i].target -ne $org.items[$i].target -or $cur.items[$i].ja -ne $org.items[$i].ja) { throw "순서가 다름: $i" }
    if (($cur.items[$i] | ConvertTo-Json -Compress -Depth 5) -ne ($org.items[$i] | ConvertTo-Json -Compress -Depth 5)) { $fixed++ }
    [void]$list.Add($org.items[$i])
  } else { [void]$list.Add($cur.items[$i]) }
}
$lines = $list | ForEach-Object { "    " + ($_ | ConvertTo-Json -Compress -Depth 5) }
$out = "{`n  `"meta`": " + ($cur.meta | ConvertTo-Json -Compress -Depth 5) + ",`n  `"items`": [`n" + ($lines -join ",`n") + "`n  ]`n}`n"
[IO.File]::WriteAllText($File, $out, $utf8)
"원본으로 되돌린 예문 $fixed 개 · 전체 " + $list.Count + "개"
