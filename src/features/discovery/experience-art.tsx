type Props = { kind: "culture" | "food" | "craft"; className?: string };

/** Original conceptual art. No real venue, heritage object or geography is depicted. */
export function ExperienceArt({ kind, className }: Props) {
  const palette = {
    culture: ["#dfd7be", "#a45338", "#566347"],
    food: ["#d8dfce", "#7d4e32", "#627b4e"],
    craft: ["#e2c8af", "#9a543f", "#686b48"],
  }[kind];
  return (
    <svg
      viewBox="0 0 420 260"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path fill={palette[0]} d="M0 0h420v260H0z" />
      <circle cx="327" cy="55" r="65" stroke="white" strokeOpacity=".35" />
      <path
        d="M0 228c101-46 217-11 420-40v72H0v-32Z"
        fill={palette[2]}
        fillOpacity=".16"
      />
      {kind === "culture" ? (
        <g>
          <path d="M110 114h200v122H110z" fill="#D4BA91" />
          <path d="m91 115 119-67 119 67H91Z" fill={palette[1]} />
          <path d="M131 105h158l-79-43-79 43Z" fill="#E1CA9E" />
          <path d="M151 132h22v104h-22zM246 132h22v104h-22z" fill="#A8815B" />
          <path d="M190 171a20 20 0 0 1 40 0v65h-40v-65Z" fill={palette[2]} />
          <path
            d="M95 236h230M84 244h251"
            stroke={palette[1]}
            strokeWidth="6"
          />
          <path
            d="M49 223V140m0 29c-16-37-34-21-34-21 15 2 20 18 34 21Zm1 17c24-38 45-22 45-22-19 1-29 17-45 22Z"
            stroke={palette[2]}
            strokeWidth="3"
            fill={palette[2]}
          />
        </g>
      ) : kind === "food" ? (
        <g>
          <ellipse cx="208" cy="190" rx="128" ry="38" fill="#ADAF8D" />
          <ellipse cx="208" cy="170" rx="126" ry="47" fill="#F7EDD7" />
          <ellipse cx="208" cy="167" rx="95" ry="32" fill={palette[1]} />
          <path
            d="M141 159c10-33 26-36 35-2M196 156c7-37 25-39 33 0M251 160c7-30 23-31 28 2"
            stroke="#D9B776"
            strokeWidth="15"
            strokeLinecap="round"
          />
          <path
            d="m153 152 16 14m37-15 13 14m39-7 12 13"
            stroke={palette[2]}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="M323 120h24v69h-24z" fill="#CBA573" />
          <ellipse cx="335" cy="120" rx="13" ry="5" fill="#F8EDD4" />
          <path
            d="M172 101c-15-18 12-23 0-45M207 101c-15-18 12-23 0-45M240 101c-15-18 12-23 0-45"
            stroke="#F5F0DE"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g>
          <path d="M92 61h232v160H92z" fill={palette[1]} />
          <path d="M103 73h210v136H103z" stroke="#E5C18E" strokeWidth="2" />
          <path
            d="m126 140 40-42 42 42-42 42-40-42Zm83 0 40-42 42 42-42 42-40-42Z"
            stroke="#E8CB9F"
            strokeWidth="5"
          />
          <path
            d="m148 140 18-18 18 18-18 18-18-18Zm83 0 18-18 18 18-18 18-18-18Z"
            fill="#C28D62"
          />
          <path
            d="M82 54h252M82 226h252"
            stroke={palette[2]}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M109 53V31M145 53V31M181 53V31M217 53V31M253 53V31M289 53V31M109 227v23M145 227v23M181 227v23M217 227v23M253 227v23M289 227v23"
            stroke="#DDC496"
            strokeWidth="3"
          />
        </g>
      )}
    </svg>
  );
}
