import { Toaster } from "sonner";
import Home from "./pages/Home";

function App() {
  return (
    <>
      <Home />
      <Toaster position="top-right" theme="light" />
    </>
  );
}

export default App;
