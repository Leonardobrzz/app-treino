export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  secondary: string[];
  equipment: string;
  created_by: string | null;
};

export type Plan = { id: string; name: string; active: boolean; created_at: string };

export type PlanDay = { id: string; plan_id: string; weekday: number; title: string };

export type PlanExercise = {
  id: string;
  plan_day_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps: string;
  target_weight: number | null;
  rest_seconds: number;
  notes: string | null;
  method?: string | null;
  exercises?: Exercise;
};

export type Session = {
  id: string;
  plan_day_id: string | null;
  title: string;
  started_at: string;
  finished_at: string | null;
};

export type SessionSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  done: boolean;
  created_at: string;
};

export type BodyWeight = { id: string; measured_on: string; weight: number; body_fat: number | null };

export const MEASURES = ["peito", "cintura", "braco", "antebraco", "coxa", "panturrilha", "quadril", "pescoco"] as const;
export type MeasureKey = (typeof MEASURES)[number];
export type BodyMeasurement = { id: string; measured_on: string } & Record<MeasureKey, number | null>;

export const MEASURE_LABEL: Record<MeasureKey, string> = {
  peito: "Peitoral",
  cintura: "Cintura",
  braco: "Braço",
  antebraco: "Antebraço",
  coxa: "Coxa",
  panturrilha: "Panturrilha",
  quadril: "Quadril",
  pescoco: "Pescoço",
};

export type Profile = {
  id: string;
  name: string | null;
  goal: string | null;
  weekly_goal: number;
  sex: "masculino" | "feminino" | "outro" | null;
  body_type: number | null;
  birth_date: string | null;
  height_cm: number | null;
  target_weight: number | null;
  pace: "lento" | "moderado" | "rapido" | null;
  level: "iniciante" | "intermediario" | "avancado" | null;
  priority_muscles: string[];
  training_days: number[];
  location: "academia" | "casa" | "corpo" | null;
  session_minutes: number | null;
  onboarded_at: string | null;
  kcal_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  water_target_ml: number | null;
  friend_code: string;
  is_trainer?: boolean;
  trainer_code?: string | null;
  cref?: string | null;
  trainer_bio?: string | null;
  trainer_city?: string | null;
  whatsapp?: string | null;
  pix_key?: string | null;
  pix_name?: string | null;
  showcase_public?: boolean;
  profession?: string | null;
  pains?: string[];
  brand_color?: string | null;
  brand_logo?: string | null;
};

export type ProgressPhoto = { id: string; taken_on: string; pose: "frente" | "lado" | "costas"; path: string; created_at: string };

export const MEAL_TYPES = ["cafe", "almoco", "lanche", "jantar"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const MEAL_LABEL: Record<MealType, string> = { cafe: "Café da manhã", almoco: "Almoço", lanche: "Lanche", jantar: "Jantar" };

export type Meal = {
  id: string;
  eaten_on: string;
  meal: MealType;
  name: string;
  portion: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "manual" | "foto" | "texto" | "chat" | "recente";
  created_at: string;
};

export type WaterLog = { id: string; logged_on: string; ml: number; created_at: string };
