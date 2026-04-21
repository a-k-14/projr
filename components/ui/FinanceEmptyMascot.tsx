import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { AppThemePalette } from '../../lib/theme';

type MascotVariant = 'budget' | 'loan' | 'activity' | 'security' | 'account';
type MascotMood = 'calm' | 'curious' | 'sleepy' | 'flat' | 'bright';

const VARIANT_MOOD: Record<MascotVariant, MascotMood> = {
  account: 'curious',
  activity: 'sleepy',
  budget: 'bright',
  loan: 'flat',
  security: 'calm',
};

export function FinanceEmptyMascot({
  palette,
  variant,
  mood = VARIANT_MOOD[variant],
}: {
  palette: AppThemePalette;
  variant: MascotVariant;
  mood?: MascotMood;
}) {
  const accent = variant === 'budget' ? palette.budget : variant === 'loan' ? palette.loan : palette.brand;
  const soft = variant === 'budget' ? palette.budgetSoft : variant === 'loan' ? palette.loanSoft : palette.brandSoft;
  const ink = palette.textSecondary;
  const body = palette.isDark ? palette.card : palette.surface;
  const side = palette.isDark ? palette.inputBg : soft;
  const cheek = variant === 'activity' ? palette.inputBg : soft;

  return (
    <Svg width={150} height={118} viewBox="0 0 150 118" fill="none">
      <Ellipse cx={76} cy={104} rx={38} ry={7} fill={palette.inputBg} opacity={0.78} />

      <Path
        d="M54 26H87L105 44V87C105 95 100 100 92 100H54C46 100 41 95 41 87V39C41 31 46 26 54 26Z"
        fill={body}
        stroke={palette.borderSoft}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M87 26V39C87 44 91 48 96 48H105L87 26Z"
        fill={side}
        stroke={palette.borderSoft}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path
        d="M105 44L109 50V89C109 97 104 102 96 102H92C100 102 105 95 105 87V44Z"
        fill={palette.inputBg}
        opacity={0.5}
      />
      <Path
        d="M48 40C48 34 52 31 58 31H80C72 37 67 46 66 58C65 72 69 88 77 100H54C46 100 41 95 41 87V39C43 40 45 40 48 40Z"
        fill={palette.inputBg}
        opacity={0.42}
      />
      <Path d="M58 44H75" stroke={soft} strokeWidth={6} strokeLinecap="round" opacity={0.76} />
      <Path d="M61 91H89" stroke={soft} strokeWidth={5} strokeLinecap="round" opacity={0.68} />
      <Circle cx={112} cy={34} r={3.8} fill={accent} opacity={0.42} />
      <Circle cx={37} cy={75} r={3.2} fill={accent} opacity={0.24} />
      <Path d="M111 78H121" stroke={palette.borderSoft} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M116 73V83" stroke={palette.borderSoft} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M31 43H39" stroke={soft} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M35 39V47" stroke={soft} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={62} cy={70} r={3.1} fill={cheek} opacity={0.72} />
      <Circle cx={90} cy={70} r={3.1} fill={cheek} opacity={0.72} />

      <MascotFace mood={mood} ink={ink} accent={accent} />
    </Svg>
  );
}

function MascotFace({
  mood,
  ink,
  accent,
}: {
  mood: MascotMood;
  ink: string;
  accent: string;
}) {
  if (mood === 'sleepy') {
    return (
      <G>
        <Path d="M62 59C66 62 70 62 74 59" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M80 59C84 62 88 62 92 59" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M69 76C74 79 82 78 87 74" stroke={accent} strokeWidth={2.8} strokeLinecap="round" />
      </G>
    );
  }

  if (mood === 'flat') {
    return (
      <G>
        <Path d="M62 60H74" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M80 60H92" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M68 77H90" stroke={accent} strokeWidth={2.8} strokeLinecap="round" />
      </G>
    );
  }

  if (mood === 'curious') {
    return (
      <G>
        <Circle cx={66} cy={61} r={3.2} fill={ink} />
        <Circle cx={87} cy={60} r={5.4} stroke={ink} strokeWidth={2.3} />
        <Path d="M70 77C76 81 84 80 89 75" stroke={accent} strokeWidth={2.8} strokeLinecap="round" />
      </G>
    );
  }

  if (mood === 'bright') {
    return (
      <G>
        <Path d="M62 59C66 56 71 56 75 59" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M80 59C84 56 89 56 93 59" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M68 73C75 83 88 83 95 73" stroke={accent} strokeWidth={3} strokeLinecap="round" />
      </G>
    );
  }

  return (
    <G>
      <Rect x={64} y={57} width={6.5} height={9.5} rx={3.25} fill={ink} />
      <Rect x={85} y={57} width={6.5} height={9.5} rx={3.25} fill={ink} />
      <Path d="M69 76C75 80 84 80 90 76" stroke={accent} strokeWidth={2.8} strokeLinecap="round" />
    </G>
  );
}
