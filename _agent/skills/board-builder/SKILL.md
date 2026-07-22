---
name: board-builder
description: GitHub API & Vercel 기반 정적 게시판 홈페이지 구축 및 동기화 스킬
---

# Board Builder Skill Specification

## Overview
이 스킬은 외부 백엔드 서버 없이 GitHub API와 Vercel Serverless Function(`/api/config`)을 활용하여 데이터 보관 및 관리자 인증을 처리하는 정적 게시판 웹 애플리케이션 사양을 정의합니다.

## Architecture
1. **Frontend**:
   - Vanilla JS + LocalStorage + GitHub REST API (Octokit 라이브러리 없이 native fetch 사용).
   - Clean URLs 지원 (`cleanUrls: true`, `.html` 없는 경로 자동 정규화).
   - Tailwind CSS 기반 모바일 반응형 UI.

2. **Backend Config Bridge (`api/config.js`)**:
   - Vercel 환경 변수 (`GITHUB_TOKEN`, `ADMIN_PASSWORD`)를 보안 통로로 제공.
   - `github_owner`, `github_repo`, `data_file_path`는 `config/git_config.json`에서 읽어 병합 (`loadConfig()`).

3. **Data Storage (`data/posts.json`)**:
   - 게시글 목록 및 마크다운 본문을 JSON 형태로 저장.
   - GitHub API (`PUT /repos/{owner}/{repo}/contents/{path}`)를 통해 자동 분기 커밋 및 동기화.

4. **Markdown Support**:
   - 자체 경량 마크다운 렌더러 `renderMarkdown()` 및 `markdownToText()` 사용.
