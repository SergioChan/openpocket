import svgPaths from "./svg-9vmg0808ts";
import imgShopping1 from "figma:asset/e10c4bacffedda0372207e483965410e75ec0563.png";
import imgSocial1 from "figma:asset/cf94a198a5b8389453fa60978b06c8fb41e5e43c.png";
import imgEntertainment1 from "figma:asset/ef5076fae78920ef490337fb490e77b047731670.png";
import imgRemoveThePocket2K2026022106051 from "figma:asset/f73f56fd308a692f93cf6f19633cc4b2497fe7fe.png";

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
        <div className="-translate-x-1/2 -translate-y-1/2 absolute flex h-[33.65px] items-center justify-center left-[calc(50%-0.03px)] top-[calc(50%+0.03px)] w-[23.232px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
          <div className="flex-none rotate-[4.94deg]">
            <Layer />
          </div>
        </div>
      </div>
    </div>
  );
}

function Text() {
  return (
    <div className="relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:SemiBold',sans-serif] leading-[28px] not-italic relative shrink-0 text-[18px] text-black">OpenPocket</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="h-[28px] relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] h-full items-center relative">
        <LogoIcon />
        <Text />
      </div>
    </div>
  );
}

function TextInput() {
  return (
    <div className="absolute bg-[rgba(111,111,111,0.06)] h-[40px] left-0 rounded-[100px] top-0 w-[471.579px]" data-name="Text Input">
      <div className="content-stretch flex items-center overflow-clip pl-[42.105px] pr-[16.842px] py-[8.421px] relative rounded-[inherit] size-full">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Search documentation...</p>
      </div>
      <div aria-hidden="true" className="absolute border-[1.053px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[100px]" />
    </div>
  );
}

function Icon() {
  return (
    <div className="absolute left-[12.14px] size-[16px] top-[11.5px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p1d2d3780} id="Vector" stroke="var(--stroke-0, #777777)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.40351" />
          <path d="M14 14L11.1334 11.1333" id="Vector_2" stroke="var(--stroke-0, #777777)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.40351" />
        </g>
      </svg>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute h-[40px] left-0 top-0 w-[471.579px]" data-name="Container">
      <TextInput />
      <Icon />
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[40px] relative shrink-0 w-[471.579px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Container2 />
      </div>
    </div>
  );
}

function Link() {
  return (
    <div className="relative shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#ff8a00] text-[14px]">Home</p>
      </div>
    </div>
  );
}

function Link1() {
  return (
    <div className="relative shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Blueprint</p>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <div className="relative shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Get Started</p>
      </div>
    </div>
  );
}

function Link3() {
  return (
    <div className="relative shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Reference</p>
      </div>
    </div>
  );
}

function Link4() {
  return (
    <div className="relative shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Runbook</p>
      </div>
    </div>
  );
}

function Link5() {
  return (
    <div className="relative shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative">
        <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#777] text-[14px]">Doc Hubs</p>
      </div>
    </div>
  );
}

function Navigation() {
  return (
    <div className="h-[20px] relative shrink-0" data-name="Navigation">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[32px] h-full items-center relative">
        <Link />
        <Link1 />
        <Link2 />
        <Link3 />
        <Link4 />
        <Link5 />
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="h-[21.053px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[33.33%]" data-name="Vector">
        <div className="absolute inset-[-12.5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.77193 8.77193">
            <path d={svgPaths.p25d85f00} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[83.33%] left-1/2 right-1/2 top-[8.33%]" data-name="Vector">
        <div className="absolute inset-[-50%_-0.88px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.75439 3.50877">
            <path d="M0.877193 0.877193V2.63158" id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[8.33%] left-1/2 right-1/2 top-[83.33%]" data-name="Vector">
        <div className="absolute inset-[-50%_-0.88px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.75439 3.50877">
            <path d="M0.877193 0.877193V2.63158" id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[20.54%_73.58%_73.58%_20.54%]" data-name="Vector">
        <div className="absolute inset-[-70.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99123 2.99123">
            <path d={svgPaths.p34f43980} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[73.58%_20.54%_20.54%_73.58%]" data-name="Vector">
        <div className="absolute inset-[-70.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99123 2.99123">
            <path d={svgPaths.p19adfd00} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/2 left-[8.33%] right-[83.33%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-0.88px_-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.50877 1.75439">
            <path d="M0.877193 0.877193H2.63158" id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/2 left-[83.33%] right-[8.33%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-0.88px_-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.50877 1.75439">
            <path d="M0.877193 0.877193H2.63158" id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[73.58%_73.58%_20.54%_20.54%]" data-name="Vector">
        <div className="absolute inset-[-70.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99123 2.99123">
            <path d={svgPaths.p18c71260} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[20.54%_20.54%_73.58%_73.58%]" data-name="Vector">
        <div className="absolute inset-[-70.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99123 2.99123">
            <path d={svgPaths.p19f88480} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="content-stretch flex flex-col items-start pb-[1.053px] pt-[9.474px] px-[9.474px] relative rounded-[8.421px] shrink-0 size-[40px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[1.053px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8.421px]" />
      <Icon1 />
    </div>
  );
}

function Icon2() {
  return (
    <div className="h-[21.053px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%_16.62%]" data-name="Vector">
        <div className="absolute inset-[-5%_-6.24%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15.8094 19.2982">
            <path d={svgPaths.p2b15f00} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[66.67%_62.5%_22.67%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-39.06%_-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.89496 4.00005">
            <path d={svgPaths.p30291480} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75439" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Link6() {
  return (
    <div className="relative rounded-[8.421px] shrink-0 size-[40px]" data-name="Link">
      <div aria-hidden="true" className="absolute border-[1.053px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8.421px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[1.053px] pt-[9.474px] px-[9.474px] relative size-full">
        <Icon2 />
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="content-stretch flex h-[40px] items-center relative shrink-0" data-name="Container">
      <Link6 />
    </div>
  );
}

function ThemeToggleButton() {
  return (
    <div className="relative shrink-0" data-name="Theme Toggle Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16.842px] items-center relative">
        <Button />
        <Container3 />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="absolute bg-white content-stretch flex h-[80px] items-center justify-between left-0 pb-px pl-[48px] pr-[48.008px] top-0 w-[1440px]" data-name="Header">
      <div aria-hidden="true" className="absolute border-[rgba(255,255,255,0.1)] border-b border-solid inset-0 pointer-events-none" />
      <Container />
      <Container1 />
      <Navigation />
      <ThemeToggleButton />
    </div>
  );
}

function BigTitle() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="big-title">
      <p className="font-['Poppins:Medium',sans-serif] leading-[0] not-italic relative shrink-0 text-[0px] text-[56px] text-black">
        <span className="font-['Poppins:Regular',sans-serif] leading-[64px]">An</span>
        <span className="leading-[64px]">{` `}</span>
        <span className="font-['Poppins:Regular',sans-serif] leading-[64px]">Intelligent</span>
        <span className="font-['Poppins:Bold',sans-serif] leading-[64px]">{` `}</span>
        <span className="font-['Foundry_Plek:Medium',sans-serif] leading-[64px] text-[#ff8a00]">Phone</span>
        <span className="font-['Foundry_Plek:Medium',sans-serif] leading-[64px]">
          <br aria-hidden="true" />
        </span>
        <span className="font-['Poppins:Regular',sans-serif] leading-[64px]">That Never Sleeps</span>
      </p>
    </div>
  );
}

function Title() {
  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0" data-name="title">
      <BigTitle />
      <p className="font-['Poppins:Regular',sans-serif] leading-[28px] not-italic relative shrink-0 text-[#707070] text-[18px] w-[587px] whitespace-pre-wrap">OpenPocket is a privacy-first, local runtime for always-on mobile agents. Automate real app tasks on a local Android emulator without ever sending execution control to the cloud.</p>
    </div>
  );
}

function Container4() {
  return (
    <div className="h-[16px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Poppins:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#777] text-[12px] top-px">INSTALL WITH NPM</p>
    </div>
  );
}

function Code() {
  return (
    <div className="content-stretch flex h-[16.5px] items-start relative shrink-0 w-[210.719px]" data-name="Code">
      <p className="font-['Menlo:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">npm install -g openpocket</p>
    </div>
  );
}

function Npm() {
  return (
    <div className="bg-[rgba(255,138,0,0.06)] content-stretch flex flex-col gap-[12px] items-start px-[32px] py-[16px] relative rounded-[10px] shrink-0 w-[587px]" data-name="npm">
      <div aria-hidden="true" className="absolute border-[#ff8a00] border-[0.8px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Container4 />
      <Code />
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d="M3.33333 8H12.6667" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p1d405500} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#ff8a00] h-[48px] relative rounded-[100px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#ff8a00] border-[0.8px] border-solid inset-0 pointer-events-none rounded-[100px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] h-full items-center px-[32px] py-[12px] relative">
        <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-center text-white whitespace-nowrap">
          <p className="leading-[24px]">Start Setup</p>
        </div>
        <Icon3 />
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] h-[48px] relative rounded-[100px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[100px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex h-full items-center px-[32px] py-[12px] relative">
        <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black text-center whitespace-nowrap">
          <p className="leading-[24px]">Read Docs</p>
        </div>
      </div>
    </div>
  );
}

function ActionButtons() {
  return (
    <div className="content-stretch flex gap-[12px] items-start relative shrink-0" data-name="action-buttons">
      <Button1 />
      <Button2 />
    </div>
  );
}

function Hero2() {
  return (
    <div className="content-stretch flex flex-col gap-[40px] items-start relative shrink-0" data-name="hero">
      <Title />
      <Npm />
      <ActionButtons />
    </div>
  );
}

function Hero1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[640px]" data-name="hero">
      <Hero2 />
    </div>
  );
}

function Hero() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="hero">
      <Hero1 />
      <div className="h-[400px] relative rounded-[8px] shrink-0 w-[589px]" data-name="Feb_21__0341_15s_202602210355_er62z 2">
        <div className="absolute inset-0 overflow-hidden rounded-[8px]">
          <video autoPlay className="absolute h-full left-[-10.28%] max-w-none top-[-0.13%] w-[120.75%]" controlsList="nodownload" loop playsInline>
            <source src="/_videos/v1/7a824f2cfba98ddf615f5b990cbaf888f477eca4" />
          </video>
        </div>
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Heading 3">
      <p className="font-['Poppins:Medium',sans-serif] leading-[28px] not-italic relative shrink-0 text-[#ff8a00] text-[32px]">Local Runtime</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">
        {`Execute mobile workflows on your own machine. `}
        <br aria-hidden="true" />
        No expensive cloud subscriptions, no data leaks.
      </p>
    </div>
  );
}

function LocalRuntime() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start py-[40px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <Heading />
      <Paragraph />
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Heading 3">
      <p className="font-['Poppins:Medium',sans-serif] leading-[28px] not-italic relative shrink-0 text-[#ff8a00] text-[32px]">Human + Agent</p>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">
        {`The perfect hybrid. Manual control when you want it, `}
        <br aria-hidden="true" />
        {`agent automation when you don't.`}
      </p>
    </div>
  );
}

function LocalRuntime1() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start py-[40px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <Heading1 />
      <Paragraph1 />
    </div>
  );
}

function Heading2() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Heading 3">
      <p className="font-['Poppins:Medium',sans-serif] leading-[28px] not-italic relative shrink-0 text-[#ff8a00] text-[32px]">{`Auditable & Private`}</p>
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">
        {`All sessions and memory stay visible and local. `}
        <br aria-hidden="true" />
        Your data, your rules.
      </p>
    </div>
  );
}

function LocalRuntime2() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start justify-center py-[40px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <Heading2 />
      <Paragraph2 />
    </div>
  );
}

function Description() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="description">
      <LocalRuntime />
      <LocalRuntime1 />
      <LocalRuntime2 />
    </div>
  );
}

function OneLiner() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start justify-center relative shrink-0 w-full" data-name="one-liner">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] not-italic relative shrink-0 text-[#707070] text-[18px]">Why OpenPocket?</p>
      <Description />
    </div>
  );
}

function Shopping() {
  return (
    <div className="relative shrink-0 size-[40px]" data-name="shopping">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[40px] left-1/2 top-1/2 w-[71.667px]" data-name="shopping 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgShopping1} />
      </div>
    </div>
  );
}

function Heading3() {
  return (
    <div className="h-[24px] relative shrink-0 w-[78px]" data-name="Heading 3">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] left-[39px] not-italic text-[16px] text-black text-center top-[12px] whitespace-nowrap">
        <p className="leading-[24px]">Shopping</p>
      </div>
    </div>
  );
}

function LocalRuntime3() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex gap-[12px] items-center px-[32px] py-[16px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Shopping />
      <Heading3 />
    </div>
  );
}

function Social() {
  return (
    <div className="relative shrink-0 size-[40px]" data-name="social">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[40px] left-1/2 top-1/2 w-[71.667px]" data-name="social 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgSocial1} />
      </div>
    </div>
  );
}

function Heading4() {
  return (
    <div className="h-[24px] relative shrink-0 w-[136px]" data-name="Heading 3">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] left-[68px] not-italic text-[16px] text-black text-center top-[12px] whitespace-nowrap">
        <p className="leading-[24px]">Social Workflows</p>
      </div>
    </div>
  );
}

function LocalRuntime4() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex gap-[12px] items-center px-[32px] py-[16px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Social />
      <Heading4 />
    </div>
  );
}

function Entertainment() {
  return (
    <div className="relative shrink-0 size-[40px]" data-name="entertainment">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[40px] left-1/2 top-1/2 w-[71.667px]" data-name="entertainment 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgEntertainment1} />
      </div>
    </div>
  );
}

function Heading5() {
  return (
    <div className="h-[24px] relative shrink-0 w-[115px]" data-name="Heading 3">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] left-[57.5px] not-italic text-[16px] text-black text-center top-[12px] whitespace-nowrap">
        <p className="leading-[24px]">Entertainment</p>
      </div>
    </div>
  );
}

function LocalRuntime5() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex gap-[12px] items-center px-[32px] py-[16px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Entertainment />
      <Heading5 />
    </div>
  );
}

function AndMoreIcon() {
  return (
    <div className="overflow-clip relative shrink-0 size-[40px]" data-name="And More Icon">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex h-[61.076px] items-center justify-center left-[calc(50%-1.47px)] top-[calc(50%+0.04px)] w-[91.068px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-[-10.19deg]">
          <div className="h-[46.933px] relative w-[84.089px]" data-name="Remove_the_pocket_2k_202602210605 1">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgRemoveThePocket2K2026022106051} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Heading6() {
  return (
    <div className="h-[24px] relative shrink-0 w-[77px]" data-name="Heading 3">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] left-[38.5px] not-italic text-[16px] text-black text-center top-[12px] whitespace-nowrap">
        <p className="leading-[24px]">And More</p>
      </div>
    </div>
  );
}

function LocalRuntime6() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex gap-[12px] items-center px-[32px] py-[16px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <AndMoreIcon />
      <Heading6 />
    </div>
  );
}

function Shopping1() {
  return (
    <div className="relative shrink-0 size-[40px]" data-name="shopping">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[40px] left-1/2 top-1/2 w-[71.667px]" data-name="shopping 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgShopping1} />
      </div>
    </div>
  );
}

function Heading7() {
  return (
    <div className="h-[24px] relative shrink-0 w-[78px]" data-name="Heading 3">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] left-[39px] not-italic text-[16px] text-black text-center top-[12px] whitespace-nowrap">
        <p className="leading-[24px]">Shopping</p>
      </div>
    </div>
  );
}

function LocalRuntime7() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex gap-[12px] items-center px-[32px] py-[16px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Shopping1 />
      <Heading7 />
    </div>
  );
}

function Social1() {
  return (
    <div className="relative shrink-0 size-[40px]" data-name="social">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[40px] left-1/2 top-1/2 w-[71.667px]" data-name="social 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgSocial1} />
      </div>
    </div>
  );
}

function Heading8() {
  return (
    <div className="h-[24px] relative shrink-0 w-[136px]" data-name="Heading 3">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] left-[68px] not-italic text-[16px] text-black text-center top-[12px] whitespace-nowrap">
        <p className="leading-[24px]">Social Workflows</p>
      </div>
    </div>
  );
}

function LocalRuntime8() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex gap-[12px] items-center px-[32px] py-[16px] relative rounded-[10px] shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Social1 />
      <Heading8 />
    </div>
  );
}

function Description1() {
  return (
    <div className="bg-white content-stretch flex gap-[24px] items-center overflow-clip py-[40px] relative shrink-0 w-full" data-name="description">
      <LocalRuntime3 />
      <LocalRuntime4 />
      <LocalRuntime5 />
      <LocalRuntime6 />
      <LocalRuntime7 />
      <LocalRuntime8 />
    </div>
  );
}

function OneLiner1() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start justify-center relative shrink-0 w-full" data-name="one-liner">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] not-italic relative shrink-0 text-[#707070] text-[18px]">Use Cases</p>
      <Description1 />
    </div>
  );
}

function Heading9() {
  return (
    <div className="h-[28px] relative shrink-0 w-[12px]" data-name="Heading 3">
      <p className="absolute font-['Poppins:Medium',sans-serif] leading-[28px] left-0 not-italic text-[#ff8a00] text-[32px] top-0">1</p>
    </div>
  );
}

function Paragraph3() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Medium',sans-serif] leading-[64px] not-italic relative shrink-0 text-[#ff8a00] text-[56px]">Ask</p>
    </div>
  );
}

function AskIcon() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0" data-name="Ask Icon">
      <Heading9 />
      <Paragraph3 />
    </div>
  );
}

function Paragraph4() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">Initiate via CLI, local panel, or custom bot.</p>
    </div>
  );
}

function LocalRuntime9() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start px-[24px] relative shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[#ff8a00] border-l border-solid inset-0 pointer-events-none" />
      <AskIcon />
      <Paragraph4 />
    </div>
  );
}

function Heading10() {
  return (
    <div className="h-[28px] relative shrink-0 w-[12px]" data-name="Heading 3">
      <p className="absolute font-['Poppins:Medium',sans-serif] leading-[28px] left-0 not-italic text-[#ff8a00] text-[32px] top-0">2</p>
    </div>
  );
}

function Paragraph5() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Medium',sans-serif] leading-[64px] not-italic relative shrink-0 text-[#ff8a00] text-[56px]">Plan</p>
    </div>
  );
}

function PlanIcon() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0" data-name="Plan Icon">
      <Heading10 />
      <Paragraph5 />
    </div>
  );
}

function Paragraph6() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">Agent chooses the next mobile action.</p>
    </div>
  );
}

function LocalRuntime10() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start px-[24px] relative shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[#ff8a00] border-l border-solid inset-0 pointer-events-none" />
      <PlanIcon />
      <Paragraph6 />
    </div>
  );
}

function Heading11() {
  return (
    <div className="h-[28px] relative shrink-0 w-[19px]" data-name="Heading 3">
      <p className="absolute font-['Poppins:Medium',sans-serif] leading-[28px] left-0 not-italic text-[#ff8a00] text-[32px] top-0">3</p>
    </div>
  );
}

function Paragraph7() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Medium',sans-serif] leading-[64px] not-italic relative shrink-0 text-[#ff8a00] text-[56px]">Act</p>
    </div>
  );
}

function ActIcon() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0" data-name="Act Icon">
      <Heading11 />
      <Paragraph7 />
    </div>
  );
}

function Paragraph8() {
  return (
    <div className="content-stretch flex items-start relative shrink-0" data-name="Paragraph">
      <p className="font-['Poppins:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-black">OpenPocket executes on your local emulator.</p>
    </div>
  );
}

function LocalRuntime11() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start px-[24px] relative shrink-0" data-name="local-runtime">
      <div aria-hidden="true" className="absolute border-[#ff8a00] border-l border-solid inset-0 pointer-events-none" />
      <ActIcon />
      <Paragraph8 />
    </div>
  );
}

function Description2() {
  return (
    <div className="content-stretch flex items-center justify-between py-[40px] relative shrink-0 w-full" data-name="description">
      <LocalRuntime9 />
      <LocalRuntime10 />
      <LocalRuntime11 />
    </div>
  );
}

function OneLiner2() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start justify-center relative shrink-0 w-full" data-name="one-liner">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] not-italic relative shrink-0 text-[#707070] text-[18px]">Simple workflow, powerful results</p>
      <Description2 />
    </div>
  );
}

function Container6() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex flex-col h-[46px] items-start px-[40px] py-[12px] relative rounded-[10px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black text-center whitespace-nowrap">
        <p className="leading-[24px]">User</p>
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="h-[24px] relative shrink-0 w-[14.18px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#707070] text-[16px] top-[-0.5px] tracking-[-0.3125px]">→</p>
    </div>
  );
}

function Container8() {
  return (
    <div className="bg-[rgba(43,127,255,0.1)] content-stretch flex flex-col h-[45.154px] items-center justify-center px-[40px] py-[12px] relative rounded-[8px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#2b7fff] border-[0.8px] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2b7fff] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[24px]">OpenPocket Runtime</p>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="h-[24px] relative shrink-0 w-[14.18px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#707070] text-[16px] top-[-0.5px] tracking-[-0.3125px]">→</p>
    </div>
  );
}

function Container10() {
  return (
    <div className="bg-[rgba(255,138,0,0.1)] content-stretch flex items-center justify-center px-[40px] py-[12px] relative rounded-[8px] shrink-0 w-[108.077px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#ff8a00] border-[0.8px] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#ff8a00] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[24px]">Agent</p>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="h-[24px] relative shrink-0 w-[14.18px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#707070] text-[16px] top-[-0.5px] tracking-[-0.3125px]">→</p>
    </div>
  );
}

function Container13() {
  return (
    <div className="bg-[rgba(43,127,255,0.1)] h-[46px] relative rounded-[8px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#2b7fff] border-[0.8px] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col h-full items-center justify-center px-[40px] py-[12px] relative">
        <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2b7fff] text-[16px] text-center whitespace-nowrap">
          <p className="leading-[24px]">ADB Runtime</p>
        </div>
      </div>
    </div>
  );
}

function Container14() {
  return (
    <div className="bg-[rgba(43,127,255,0.1)] flex-[1_0_0] min-h-px min-w-px relative rounded-[8px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#2b7fff] border-[0.8px] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col h-full items-center justify-center px-[40px] py-[12px] relative">
        <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2b7fff] text-[16px] text-center whitespace-nowrap">
          <p className="leading-[24px]">Local Artifacts</p>
        </div>
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] h-[104px] items-center relative shrink-0" data-name="Container">
      <Container13 />
      <Container14 />
    </div>
  );
}

function Container15() {
  return (
    <div className="h-[24px] relative shrink-0 w-[14.18px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#707070] text-[16px] top-[-0.5px] tracking-[-0.3125px]">→</p>
    </div>
  );
}

function Container16() {
  return (
    <div className="bg-[rgba(111,111,111,0.06)] content-stretch flex flex-col h-[46px] items-start px-[40px] py-[12px] relative rounded-[10px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black text-center whitespace-nowrap">
        <p className="leading-[24px]">Android Emulator</p>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="content-stretch flex items-center justify-between py-[40px] relative shrink-0 w-full" data-name="Container">
      <Container6 />
      <Container7 />
      <Container8 />
      <Container9 />
      <Container10 />
      <Container11 />
      <Container12 />
      <Container15 />
      <Container16 />
    </div>
  );
}

function OneLiner3() {
  return (
    <div className="content-stretch flex flex-col gap-[40px] items-start justify-center relative shrink-0 w-full" data-name="one-liner">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] not-italic relative shrink-0 text-[#707070] text-[18px]">Architecture</p>
      <Container5 />
    </div>
  );
}

function Frame() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="content-stretch flex flex-col gap-[120px] items-start px-[80px] py-[160px] relative w-full">
        <Hero />
        <OneLiner />
        <OneLiner1 />
        <OneLiner2 />
        <OneLiner3 />
      </div>
    </div>
  );
}

export default function OpenpocketRedesign() {
  return (
    <div className="bg-white content-stretch flex flex-col items-start relative size-full" data-name="openpocket_redesign">
      <Header />
      <Frame />
    </div>
  );
}