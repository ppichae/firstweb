# JMdict 대조 결과를 data/review/checks.json에 id 목록으로 저장한다 (사전 내용은 저장하지 않음)
param([string]$Pairs, [string]$Repo)
$set = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($line in [IO.File]::ReadLines($Pairs, [Text.Encoding]::UTF8)) { [void]$set.Add($line) }
$out = [ordered]@{}
foreach ($pair in @(@("n1vocab", "n1\vocab.json"), @("n3vocab", "n3\vocab.json"), @("core", "vocabulary.json"))) {
  $j = [IO.File]::ReadAllText("$Repo\data\$($pair[1])", [Text.Encoding]::UTF8) | ConvertFrom-Json
  $ok = @(); $phrase = @()
  foreach ($v in $j.items) { if ($set.Contains("$($v.word)`t$($v.reading)")) { $ok += $v.id } else { $phrase += $v.id } }
  $out[$pair[0]] = [ordered]@{ readingMatched = $ok; notInDictionary = $phrase }
}
$doc = [ordered]@{
  meta = [ordered]@{
    title = "자료 검수 기록"; updated = "2026-10-31"
    note = "단어 표기·읽기를 JMdict(EDRDG, CC BY-SA 4.0)와 대조한 결과입니다. 사전 내용은 옮겨 싣지 않고, 일치한 항목의 id만 적었습니다. readingMatched = 표기와 읽기가 사전의 한 항목과 정확히 일치. notInDictionary = 여러 단어로 된 구절 등 사전에 표제어로 없는 항목(틀렸다는 뜻이 아니라 대조하지 못했다는 뜻). 한국어 뜻은 AI가 쓴 것이라 이 대조로 검수되지 않습니다."
    checkedAt = "2026-10-31"; dictionary = "JMdict_e (http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz)"
  }
  vocab = $out
}
New-Item -ItemType Directory -Force "$Repo\data\review" | Out-Null
[IO.File]::WriteAllText("$Repo\data\review\checks.json", ($doc | ConvertTo-Json -Depth 5 -Compress), (New-Object Text.UTF8Encoding $false))
foreach ($k in $out.Keys) { "$k : 일치 " + $out[$k].readingMatched.Count + " / 대조 못함 " + $out[$k].notInDictionary.Count }