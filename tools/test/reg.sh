#!/bin/sh
# 전체 회귀 테스트: 테스트마다 통과 개수와 실패 줄만 보여 준다
S="/c/Users/Owner/AppData/Local/Temp/claude/c--Users-Owner-Documents-firstweb/aff8e9c3-ffd7-48f7-8ee2-a6d92d386652/scratchpad"
cd "$S"
r(){ n=$1; shift; out=$("$@"); p=$(echo "$out" | grep -c '^PASS'); f=$(echo "$out" | grep -v '^PASS' | grep -v '^$' | grep -v '^RUNNING$'); echo "== $n PASS $p"; if [ -n "$f" ]; then echo "$f" | cut -c1-220; fi; }
case "$1" in
1)
r "s41" env PRE=pre41.js BUDGET=200000 sh rs.sh s41.js 1440 1000 "#"
r "s42" env BUDGET=200000 sh rs.sh s42.js 1440 1000 "#"
r "s5" env BUDGET=200000 sh rs.sh s5.js 1440 1000 "#home"
r "s6" env BUDGET=200000 sh rs.sh s6.js 1440 1000 "#"
r "s7" env BUDGET=200000 sh rs.sh s7.js 1440 1000 "#n3"
r "s8" env PRE=pre8.js BUDGET=200000 sh rs.sh s8.js 1440 1000 "#"
r "s9" env BUDGET=200000 sh rs.sh s9.js 1440 1000 "#home"
r "sA" env BUDGET=200000 sh rs.sh sA.js 1440 1000 "#"
;;
2)
r "sB" env BUDGET=400000 sh rs.sh sB.js 1440 1000
r "sEx" env BUDGET=200000 sh rs.sh sEx.js 1440 1000
r "sStats" env PRE=preStats.js BUDGET=200000 sh rs.sh sStats.js 1440 1000 "#n3"
r "sLevel 390 다크" env PRE=preLevelD.js BUDGET=200000 sh rs.sh sLevel.js 390 844 "#n3"
r "sK N1" env PRE=preKN1.js BUDGET=200000 sh rs.sh sK.js 1440 1000
r "sK N3 다크 390" env PRE=preKN3d.js BUDGET=200000 sh rs.sh sK.js 390 844
r "sN1 768" env PRE=preN1.js BUDGET=200000 sh rs.sh sN1.js 768 1024
r "t6n" env BUDGET=200000 sh rs.sh t6n.js 1440 1000 "#home"
r "t7n" env BUDGET=200000 sh rs.sh t7n.js 1440 1000 "#home"
r "t8" env BUDGET=200000 sh rs.sh t8.js 1440 1000 "#home"
r "t11n" env TMO=150 sh rs.sh t11n.js 1440 1000 "#home"
;;
3)
r "s10 1440" env BUDGET=250000 sh rs.sh s10.js 1440 1000
r "s10 390" env BUDGET=250000 sh rs.sh s10.js 390 844


r "sAuthOn" env AUTHQ= BUDGET=120000 sh rs.sh sAuthOn.js 1440 1000 "#vocab"
;;
4)
r "sSync" env TMO=450 BUDGET=700000 sh rs.sh sSync.js 1440 1000 "?sb=test#login"
r "sSync2" env TMO=450 BUDGET=700000 sh rs.sh sSync2.js 1440 1000 "?sb=test#login"
r "sSync3 390 다크" env PRE=preDark.js TMO=400 BUDGET=600000 sh rs.sh sSync3.js 390 844 "?sb=test#login"
r "sSyncNew" env TMO=450 BUDGET=700000 sh rs.sh sSyncNew.js 1440 1000 "?sb=test#login"
;;
5)
r "sPartner 1440" env TMO=450 BUDGET=700000 sh rs.sh sPartner.js 1440 1000 "?sb=test#login"
r "sPartner 390 다크" env PRE=preDark.js TMO=450 BUDGET=700000 sh rs.sh sPartner.js 390 844 "?sb=test#login"
;;
esac
