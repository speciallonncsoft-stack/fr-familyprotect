/* ============================================================================
   tracking.js  —  GA4 이벤트 추적 (랜딩페이지 4종 공용)
   ----------------------------------------------------------------------------
   이 파일 하나를 4개 랜딩페이지가 그대로 공유합니다.
   각 HTML은 </body> 앞에 <script src="tracking.js"></script> 한 줄만 있으면 됨.
   ★ HTML <head> 에 별도의 gtag 스니펫(<!-- Google tag -->)을 넣지 마세요.
     이 파일이 gtag 로드와 초기화(config)를 스스로 처리하므로,
     따로 넣으면 이중 로드되어 데이터가 꼬입니다.

   ▣ 담당자 배포 전 확인 (딱 2가지)
     1) 아래 GA4_ID 가 올바른 새 측정 ID 인지 확인 (기본값 이미 반영됨)
     2) 본인 사이트의 실제 도메인이 아래 CONCEPT_MAP 의 키워드와 맞는지 확인
        - familyprotection-landing.vercel.app  → protection
        - soho-ai-answering.vercel.app         → soho_answering
        - factcheck-landing.vercel.app         → factcheck
        - ai-call-assistant-landing.vercel.app → ai_call_assistant
        도메인을 바꿔서 배포하면 CONCEPT_MAP 의 키워드도 같이 고쳐야 함.

   ▣ 잡는 이벤트 (4개)
        page_view        - 페이지 도착 (GA가 자동으로 잡음, 코드 불필요)
        cta_click        - '#survey'로 가는 CTA 버튼 클릭 (설문 진입 의향)
        survey_start     - 설문 첫 답 클릭 (실제 설문 진입)
        survey_complete  - 설문 제출 성공 (전환 = 핵심 지표)
        └ 모든 이벤트에 concept(어느 랜딩인지) 가 자동으로 함께 전송됨
        └ survey_complete 에는 사용자가 고른 답(언어·응답값)도 함께 전송

   ▣ 동작 안 하는 경우
        - 측정 ID가 비정상(G-XXXXXXXXXX)이면 GA 전송을 건너뛰고 콘솔에만 로그.
        - localhost/파일 열기에서도 콘솔 로그로 확인 가능.
   ============================================================================ */

(function () {
  'use strict';

  /* ▼▼▼ GA4 측정 ID (4개 랜딩 공통 단일 속성) ▼▼▼ */
  var GA4_ID = 'G-0MH9230B7L';
  /* ▲▲▲ 여기만 바뀌면 전체 전송 대상이 바뀝니다 ▲▲▲ */

  /* ---- 현재 도메인이 어떤 컨셉인지 판별 (hostname 기반) ---- */
  var host = (location.hostname || '').toLowerCase();
  var CONCEPT =
      host.indexOf('familyprotection') > -1 ? 'protection' :
      host.indexOf('soho')             > -1 ? 'soho_answering' :
      host.indexOf('factcheck')        > -1 ? 'factcheck' :
      host.indexOf('ai-call-assistant')> -1 ? 'ai_call_assistant' :
      'unknown';   /* 어디에도 안 맞으면 unknown 으로 들어옴 → 도메인/키워드 점검 신호 */

  var idReady = /^G-[A-Z0-9]+$/i.test(GA4_ID) && GA4_ID !== 'G-XXXXXXXXXX';

  /* ---- GA4(gtag) 로드 : ID가 준비됐을 때만 ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }

  if (idReady) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    /* config 에도 concept 를 기본값으로 실어두면 page_view 에도 concept 가 붙음 */
    gtag('config', GA4_ID, { concept: CONCEPT });
  } else {
    console.warn('[tracking] GA4 측정 ID가 아직 없습니다. 이벤트는 콘솔에만 기록됩니다.');
  }

  /* ---- 이벤트 전송 헬퍼 : 모든 이벤트에 concept 자동 부착 ---- */
  function sendEvent(name, params) {
    params = params || {};
    params.concept = CONCEPT;
    if (idReady && typeof gtag === 'function') {
      gtag('event', name, params);
    }
    console.log('[tracking] ' + name, params);
  }

  /* ---- 페이지에서 실행 ---- */
  function init() {

    /* 1) CTA 클릭 : href가 #survey 로 가는 모든 버튼/링크 */
    document.querySelectorAll('a[href="#survey"]').forEach(function (el) {
      el.addEventListener('click', function () {
        sendEvent('cta_click', {
          location: el.closest('.mobile-sticky') ? 'sticky'
                  : el.closest('.hero')          ? 'hero'
                  : el.closest('.header')        ? 'header'
                  : el.closest('.final-cta')     ? 'final'
                  : 'other'
        });
      });
    });

    /* 2) 설문 시작 : 설문 영역 안의 옵션(.option)을 처음 누른 순간 1회만 */
    var surveyStarted = false;
    var surveyRoot = document.getElementById('survey');
    if (surveyRoot) {
      surveyRoot.addEventListener('click', function (e) {
        var opt = e.target.closest('.option');
        if (opt && !surveyStarted) {
          surveyStarted = true;
          sendEvent('survey_start', {});
        }
      });
    }

    /* 3) 설문 완료 : 성공 화면(#surveySuccess)이 표시되는 순간 감지
          - 템플릿은 완료 시 #surveySuccess 에 'show' 클래스를 추가함
          - 그 변화를 MutationObserver 로 관찰해 1회만 전송 */
    var success = document.getElementById('surveySuccess');
    if (success && 'MutationObserver' in window) {
      var fired = false;
      var mo = new MutationObserver(function () {
        if (!fired && success.classList.contains('show')) {
          fired = true;

          /* 완료 시점에 사용자가 고른 답을 함께 전송
             (요약 화면 #surveySummary 의 값들을 읽어 담음) */
          var params = { language: document.documentElement.lang || 'ko' };
          try {
            var rows = document.querySelectorAll('#surveySummary .summary-row');
            rows.forEach(function (row, i) {
              var val = row.querySelector('strong');
              if (val) params['answer_' + (i + 1)] = val.textContent.trim().slice(0, 90);
            });
          } catch (err) { /* 요약 못 읽어도 완료 자체는 기록 */ }

          sendEvent('survey_complete', params);
        }
      });
      mo.observe(success, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
