// 로그인(인증) 설정
// Supabase 프로젝트 주소와 공개 키(publishable key)를 넣으면 Google 로그인이 켜진다. 비어 있으면 '준비 중'으로 표시한다.
// 공개 키는 원래 브라우저에 공개해도 되는 값이다. 비밀 키(secret / service_role)와 Google 클라이언트 보안 비밀은
// 절대 이 파일이나 저장소에 넣지 않는다 (Google 보안 비밀은 Supabase 대시보드에만 입력한다).
export const AUTH_CONFIG = {
  supabaseUrl: "",
  publishableKey: "",
  // 로그인을 마치고 돌아올 주소: 지금 열린 사이트 주소(실제 사이트 또는 테스트 서버).
  // Supabase의 Redirect URLs에 등록된 주소(https://ppichae.github.io/firstweb/, http://localhost:8765/)만 허용된다
  redirectTo: location.origin + location.pathname,
};
