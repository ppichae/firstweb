# 한자 자료(common.json)의 음독·훈독·한국 한자음·획수를 KANJIDIC2와 대조한다 (KANJIDIC2 파일은 대조에만 쓰고 배포하지 않는다)
param([string]$Xml, [string]$Json)
$ErrorActionPreference = "Stop"
$text = [IO.File]::ReadAllText($Xml, [Text.Encoding]::UTF8)
$j = [IO.File]::ReadAllText($Json, [Text.Encoding]::UTF8) | ConvertFrom-Json
# 한글 음절 → 음 (KANJIDIC2의 korean_h)
$rows = @()
foreach ($k in $j.items) {
  $c = $k.char
  $m = [regex]::Match($text, "<character>\s*<literal>" + [regex]::Escape($c) + "</literal>(.*?)</character>", "Singleline")
  if (-not $m.Success) { $rows += "$c`t사전에 없음"; continue }
  $blk = $m.Groups[1].Value
  $on = @([regex]::Matches($blk, '<reading r_type="ja_on">([^<]+)</reading>') | ForEach-Object { $_.Groups[1].Value })
  $kun = @([regex]::Matches($blk, '<reading r_type="ja_kun">([^<]+)</reading>') | ForEach-Object { $_.Groups[1].Value })
  $kh = @([regex]::Matches($blk, '<reading r_type="korean_h">([^<]+)</reading>') | ForEach-Object { $_.Groups[1].Value })
  $sc = ([regex]::Match($blk, '<stroke_count>(\d+)</stroke_count>')).Groups[1].Value
  $jl = ([regex]::Match($blk, '<jlpt>(\d)</jlpt>')).Groups[1].Value
  $gr = ([regex]::Match($blk, '<grade>(\d+)</grade>')).Groups[1].Value
  $kunNorm = $kun | ForEach-Object { ($_ -replace '\.', '-') -replace '^-|-$', '' }
  $badOn = @($k.on | Where-Object { $on -notcontains $_ })
  $badKun = @($k.kun | Where-Object { $kunNorm -notcontains $_ })
  $eum = if ($k.ko) { $k.ko.eum } else { $null }
  # 두음법칙: 사전의 '령·력·념·류·려·로·림' 등은 단어 첫머리에서 '영·역·염·유·여·노·임'이 된다
  $eumOk = if ($null -eq $eum) { if ($kh.Count) { "사전에 한국음 있음(" + ($kh -join ",") + ")" } else { "OK(둘 다 없음)" } } elseif ($kh -contains $eum) { "OK" } else { "다름 자료=" + $eum + " 사전=" + ($kh -join ",") }
  $rows += "$c`t획수 자료=$($k.strokes)/사전=$sc`t음독불일치=$($badOn -join ',')`t훈독불일치=$($badKun -join ',')`t한국음 $eumOk`tgrade=$gr`t옛JLPT=$jl"
}
$rows