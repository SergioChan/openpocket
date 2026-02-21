import svgPaths from "../../imports/svg-9vmg0808ts";

export function Hero() {
  return (
    <section className="flex items-center justify-between gap-16 w-full">
      <div className="flex flex-col gap-10 w-[640px] shrink-0">
        {/* Title */}
        <div className="flex flex-col gap-8">
          <h1 className="font-['Poppins:Medium',sans-serif] text-[56px] leading-[64px]">
            <span className="font-['Poppins:Regular',sans-serif]">An</span>
            {` `}
            <span className="font-['Poppins:Regular',sans-serif]">Intelligent</span>
            {` `}
            <span className="text-[#ff8a00]">Phone</span>
            <br />
            <span className="font-['Poppins:Regular',sans-serif]">That Never Sleeps</span>
          </h1>
          <p className="font-['Poppins:Regular',sans-serif] leading-[28px] text-[18px] text-[#707070] w-[587px]">
            OpenPocket is a privacy-first, local runtime for always-on mobile agents. Automate real app tasks on a local Android emulator without ever sending execution control to the cloud.
          </p>
        </div>

        {/* NPM Install */}
        <div className="bg-[rgba(255,138,0,0.06)] border border-[#ff8a00] rounded-[10px] px-8 py-4 flex flex-col gap-3 w-[587px]">
          <p className="font-['Poppins:Regular',sans-serif] leading-[16px] text-[12px] text-[#777] uppercase">
            Install with NPM
          </p>
          <code className="font-['Menlo:Regular',monospace] leading-[20px] text-[14px] text-black">
            npm install -g openpocket
          </code>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button className="bg-[#ff8a00] hover:bg-[#e67d00] transition-colors border border-[#ff8a00] rounded-[100px] px-8 py-3 h-12 flex items-center justify-center gap-4">
            <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-white whitespace-nowrap">
              Start Setup
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M3.33333 8H12.6667" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d={svgPaths.p1d405500} stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="bg-[rgba(111,111,111,0.06)] hover:bg-[rgba(111,111,111,0.1)] transition-colors border border-[rgba(0,0,0,0.1)] rounded-[100px] px-8 py-3 h-12 flex items-center justify-center">
            <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-black whitespace-nowrap">
              Read Docs
            </span>
          </button>
        </div>
      </div>

      {/* Video/Image */}
      <div className="relative rounded-[8px] overflow-hidden w-[589px] h-[400px] shrink-0 bg-gradient-to-br from-orange-100 to-orange-50">
        <video 
          autoPlay 
          loop 
          muted
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
          controlsList="nodownload"
        >
          <source src="/_videos/v1/7a824f2cfba98ddf615f5b990cbaf888f477eca4" />
        </video>
      </div>
    </section>
  );
}