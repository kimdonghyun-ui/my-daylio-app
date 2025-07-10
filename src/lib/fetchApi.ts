//lib/ (비즈니스 로직 & 외부 API 관련 함수)

// 📌 개념:

// - 특정 비즈니스 로직이 들어간 코드를 저장하는 폴더
// - API 호출, Zustand 상태 업데이트, 인증 관련 기능 등을 포함
// - utils/와 다르게 상태(store)나 API 연동이 포함될 수도 있음


import { useAuthStore } from "@/store/authStore"; //zustand 
import { ApiError, handleResponse } from "@/utils/utils"; //
import { refreshApi } from "./api"; //
import { performLogout, updateAccessToken } from "@/lib/auth"; //

// 통합된 API 요청 함수
export async function fetchApi<T>(
    url: string, // 요청할 url
    options: RequestInit = {}, // 요청 옵션
    auth: boolean = true, // 인증 여부
    retry: boolean = true, //토큰 만료시 무한 반복 방지 용도
): Promise<T> {

    // accessToken 불러오기
	const accessToken = auth ? useAuthStore.getState().accessToken : null;
	const isFormData = options.body instanceof FormData;

	const headers = {
		...(isFormData ? {} : { "Content-Type": "application/json" }), // ✅ FormData일 땐 제거
		...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
	};

    const defaultOptions :RequestInit = { ...options, headers }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER_URL}${url}`, defaultOptions);

    
    // 인증이 필요한 경우 토큰 만료 처리
    if (auth && retry && response.status === 401) {
        try {

            const result = await refreshApi(); // 🚨 여기서 실패하면 바로 catch로
            const jwt = result?.jwt;
          
            if (!jwt) {
                console.warn("❌ Refresh는 성공했지만 토큰이 없음");
                throw new ApiError(401, "Refresh token expired");
            }
            
            await updateAccessToken(jwt); // ✅ 토큰 갱신
            return fetchApi<T>(url, options, auth, false); // ✅ 3) 다시 원래 요청 시도

        } catch (error) {
            console.error('refreshApi 에러 발생:', error);
            await performLogout(); // 로그아웃 처리 기능 모음(
            throw new ApiError(401, "Session expired");
        }
    }

    return handleResponse<T>(response);
}
