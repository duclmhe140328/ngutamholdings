import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center">
        {/* Số 404 với hiệu ứng màu gradient */}
        <h1 className="text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
          404
        </h1>
        
        {/* Tiêu đề chính */}
        <h2 className="mt-4 text-3xl font-bold text-gray-900 tracking-tight sm:text-5xl">
          Ôi không!
        </h2>
        
        {/* Lời giải thích thân thiện */}
        <p className="mt-4 text-base text-gray-500 max-w-sm mx-auto">
          Trang bạn đang tìm kiếm không tồn tại, đã bị xóa hoặc tạm thời không thể truy cập.
        </p>
        
        {/* Nút quay về trang chủ có icon */}
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg hover:-translate-y-1"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;