import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-linear-to-r from-purple-100 via-pink-100 to-yellow-100 px-4">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-red-600 mb-6">
          Oops! Page not found
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-gray-700 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/">
          <button className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105">
            Go to Home
          </button>
        </Link>
      </div>
    </div>
  );
}
