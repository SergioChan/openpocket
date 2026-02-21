import { Container, Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { WhyOpenPocket } from "./components/WhyOpenPocket";
import { UseCases } from "./components/UseCases";
import { SimpleWorkflow } from "./components/SimpleWorkflow";
import { Architecture } from "./components/Architecture";

export default function App() {
  return (
    <div className="w-screen min-h-screen bg-white overflow-x-auto">
      <div className="min-w-[1280px]">
        <Header />
        <main className="flex flex-col gap-[120px] px-[80px] py-[160px]">
          <Hero />
          <WhyOpenPocket />
          <UseCases />
          <SimpleWorkflow />
          <Architecture />
        </main>
      </div>
    </div>
  );
}