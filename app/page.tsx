export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">MylesNet Dashboard</h1>
        <p className="text-gray-600 mb-6">Network Operations Center</p>
        <a
          href="/dashboard"
          className="inline-block bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
