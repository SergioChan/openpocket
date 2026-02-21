import svgPaths from "../../imports/svg-9vmg0808ts";

function Layer() {
  return (
    <div className="h-[32px] relative w-[20.555px]" data-name="Layer_1">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.5549 32">
        <g clipPath="url(#clip0_1_220)" id="Layer_1">
          <path d={svgPaths.p3c73bef0} fill="var(--fill-0, #FF8A00)" fillOpacity="0.9" id="Vector" stroke="var(--stroke-0, #FF8A00)" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="0.2" />
          <path d={svgPaths.pf062800} fill="var(--fill-0, #FF8A00)" id="Vector_2" stroke="var(--stroke-0, #FF8A00)" strokeMiterlimit="10" strokeWidth="0.0217323" />
          <g id="Union" />
          <path d={svgPaths.p11d1500} fill="var(--fill-0, #FFC17F)" id="Vector_3" />
          <path d={svgPaths.p2a103380} fill="var(--fill-0, #FFF2E4)" id="Vector_4" />
          <g clipPath="url(#clip1_1_220)" id="Layer_1_2">
            <path d={svgPaths.p1f71d700} fill="var(--fill-0, #FF8A00)" id="Vector_5" />
            <path d={svgPaths.p225b0800} fill="var(--fill-0, #FF8A00)" id="Vector (Stroke)" />
          </g>
          <path d={svgPaths.p29264900} fill="var(--fill-0, #FF8A00)" id="Vector_6" stroke="var(--stroke-0, #FF8A00)" strokeMiterlimit="10" strokeWidth="0.0217323" />
          <path d={svgPaths.p30792f00} fill="var(--fill-0, #FF8A00)" fillOpacity="0.3" id="Vector_7" stroke="var(--stroke-0, #FF8A00)" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="0.2" />
          <path d={svgPaths.pe67e770} id="Vector_8" stroke="var(--stroke-0, #FF8A00)" strokeDasharray="1 0.91" strokeLinecap="round" strokeMiterlimit="1.30541" strokeOpacity="0.9" strokeWidth="0.2" />
        </g>
        <defs>
          <clipPath id="clip0_1_220">
            <rect fill="white" height="32" width="20.5549" />
          </clipPath>
          <clipPath id="clip1_1_220">
            <rect fill="white" height="10.3333" transform="translate(5.43369 8.73652)" width="9.68458" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function LogoIcon() {
  return (
    <div className="h-[32px] relative shrink-0 w-[22.857px]" data-name="Logo Icon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute flex h-[33.65px] items-center justify-center left-[calc(50%-0.03px)] top-[calc(50%+0.03px)] w-[23.232px]">
          <div className="flex-none rotate-[4.94deg]">
            <Layer />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Container() {
  return (
    <div className="h-[28px] relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] h-full items-center relative">
        <LogoIcon />
        <p className="font-['Poppins:SemiBold',sans-serif] leading-[28px] not-italic relative shrink-0 text-[18px] text-black">OpenPocket</p>
      </div>
    </div>
  );
}

function SearchBar() {
  return (
    <div className="relative h-[40px] w-[471px] shrink-0">
      <div className="absolute bg-[rgba(111,111,111,0.06)] h-[40px] left-0 rounded-[100px] top-0 w-full">
        <div className="content-stretch flex items-center overflow-clip pl-[42px] pr-[16px] py-[8px] relative rounded-[inherit] size-full">
          <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Search documentation...</p>
        </div>
        <div aria-hidden="true" className="absolute border-[1.053px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[100px]" />
      </div>
      <div className="absolute left-[12px] size-[16px] top-[12px]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
          <g id="Icon">
            <path d={svgPaths.p1d2d3780} id="Vector" stroke="var(--stroke-0, #777777)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.40351" />
            <path d="M14 14L11.1334 11.1333" id="Vector_2" stroke="var(--stroke-0, #777777)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.40351" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Navigation() {
  const links = ["Home", "Blueprint", "Get Started", "Reference", "Runbook", "Doc Hubs"];
  
  return (
    <nav className="flex gap-8 items-center shrink-0">
      {links.map((link, index) => (
        <a
          key={link}
          href="#"
          className={`font-['Poppins:Regular',sans-serif] leading-[20px] text-[14px] whitespace-nowrap ${
            index === 0 ? "text-[#ff8a00]" : "text-[#777]"
          } hover:text-[#ff8a00] transition-colors`}
        >
          {link}
        </a>
      ))}
    </nav>
  );
}

function ThemeButtons() {
  return (
    <div className="flex gap-4 items-center">
      <button className="border border-[rgba(0,0,0,0.1)] rounded-[8px] p-[9px] w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors">
        <svg className="w-[21px] h-[21px]" fill="none" viewBox="0 0 21 21">
          <circle cx="10.5" cy="10.5" r="3" stroke="black" strokeWidth="1.75" />
          <line x1="10.5" y1="2" x2="10.5" y2="4" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="10.5" y1="17" x2="10.5" y2="19" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="2" y1="10.5" x2="4" y2="10.5" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="17" y1="10.5" x2="19" y2="10.5" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="4.5" y1="4.5" x2="5.9" y2="5.9" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="15.1" y1="15.1" x2="16.5" y2="16.5" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="4.5" y1="16.5" x2="5.9" y2="15.1" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="15.1" y1="5.9" x2="16.5" y2="4.5" stroke="black" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      <button className="border border-[rgba(0,0,0,0.1)] rounded-[8px] p-[9px] w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors">
        <svg className="w-[21px] h-[21px]" fill="none" viewBox="0 0 16 21">
          <path d={svgPaths.p2b15f00} stroke="black" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <path d={svgPaths.p30291480} stroke="black" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function Header() {
  return (
    <header className="bg-white border-b border-[rgba(255,255,255,0.1)] sticky top-0 z-50 w-full">
      <div className="flex items-center justify-between h-20 px-[80px] gap-8">
        <Container />
        <SearchBar />
        <Navigation />
        <ThemeButtons />
      </div>
    </header>
  );
}