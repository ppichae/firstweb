# 단어 목록의 표기·읽기 쌍이 JMdict에 있는지 확인한다 (JMdict는 대조에만 쓰고 배포하지 않는다)
param([string]$Pairs, [string]$Repo)
$set = New-Object 'System.Collections.Generic.HashSet[string]'
$words = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($line in [IO.File]::ReadLines($Pairs, [Text.Encoding]::UTF8)) { [void]$set.Add($line); [void]$words.Add($line.Split("`t")[0]) }
$toHira = { param($s) -join ($s.ToCharArray() | ForEach-Object { $c = [int]$_; if ($c -ge 0x30A1 -and $c -le 0x30F6) { [char]($c - 0x60) } else { $_ } }) }
foreach ($f in "n1\vocab.json", "n3\vocab.json", "vocabulary.json") {
  $j = [IO.File]::ReadAllText("$Repo\data\$f", [Text.Encoding]::UTF8) | ConvertFrom-Json
  $ok = 0; $wordOnly = @(); $none = @()
  foreach ($v in $j.items) {
    $w = $v.word; $r = $v.reading
    if ($set.Contains("$w`t$r") -or $set.Contains("$w`t" + (& $toHira $r))) { $ok++ }
    elseif ($words.Contains($w)) { $wordOnly += "$w=$r" }
    else { $none += "$w=$r" }
  }
  "$f : 표기·읽기 일치 $ok / $($j.items.Count) · 표기는 있으나 읽기 다름 $($wordOnly.Count) · 사전에 표기 없음 $($none.Count)"
  "   읽기 다름: " + ($wordOnly -join ", ")
  "   표기 없음: " + (($none | Select-Object -First 40) -join ", ")
}