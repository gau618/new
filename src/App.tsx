import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts";
import { LandingPage, EditorPage } from "./pages";
import "./App.css";

// Protected route wrapper - redirects to landing if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { user, isAuthenticated, isInitialized, signOut } = useAuth();
  const navigate = useNavigate();

  // Show loading while Firebase auth initializes
  if (!isInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const handleEnterEditor = () => {
    navigate("/editor");
  };

  const handleExitEditor = () => {
    navigate("/");
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            user={
              isAuthenticated && user
                ? { email: user.email || "", name: user.displayName || "User" }
                : null
            }
            onEnterEditor={handleEnterEditor}
            onLogout={signOut}
          />
        }
      />
      <Route
        path="/editor"
        element={
          <ProtectedRoute>
            <EditorPage
              user={{
                email: user?.email || "",
                name: user?.displayName || "User",
              }}
              onLogout={signOut}
              onExit={handleExitEditor}
            />
          </ProtectedRoute>
        }
      />
      {/* Redirect any unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
