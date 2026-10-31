// 로그인(인증) 설정
// Supabase 프로젝트 주소와 공개 키(publishable key)를 넣으면 Google 로그인이 켜진다. 비어 있으면 '준비 중'으로 표시한다.
// 공개 키는 원래 브라우저에 공개해도 되는 값이다. 비밀 키(secret / service_role)와 Google 클라이언트 보안 비밀은
// 절대 이 파일이나 저장소에 넣지 않는다 (Google 보안 비밀은 Supabase 대시보드에만 입력한다).
export const AUTH_CONFIG = {
  supabaseUrl: "https://twilteeguigiiuslfdsg.supabase.co",
  publishableKey: "sb_publishable_izfhKIodpvO-pPqI5Nl6HQ_5TzQW-9z",
  // 로그인을 마치고 돌아올 주소: 지금 열린 사이트 주소(실제 사이트 또는 테스트 서버).
  // Supabase의 Redirect URLs에 등록된 주소(https://ppichae.github.io/firstweb/, http://localhost:8765/)만 허용된다
  redirectTo: location.origin + location.pathname,
};

// 테스트용 프로젝트(firstweb-test): 이 컴퓨터의 테스트 서버(localhost)에서 주소에 ?sb=test를 붙였을 때만 쓴다.
// 실제 사이트에서는 절대 쓰이지 않는다. 테스트 계정은 이메일·비밀번호로 만든다.
export const TEST_AUTH_CONFIG = {
  supabaseUrl: "https://mgtkbuenrgrbgclkizpb.supabase.co",
  publishableKey: "sb_publishable_8LfEkT3qCp0G1bdDts-TOQ_fVcluKFH",
  redirectTo: location.origin + location.pathname,
};
