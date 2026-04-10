import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import People from "./pages/People";
import Detail from "./pages/Detail";
import New from "./pages/New";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/people"
          element={
            <PrivateRoute>
              <People />
            </PrivateRoute>
          }
        />
        <Route
          path="/people/new"
          element={
            <PrivateRoute>
              <New />
            </PrivateRoute>
          }
        />
        <Route
          path="/people/:id"
          element={
            <PrivateRoute>
              <Detail />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
