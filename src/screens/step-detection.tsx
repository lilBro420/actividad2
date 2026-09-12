import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import type { Subscription } from 'expo-sensors/build/Pedometer';

type ActivityState = 'idle' | 'walking' | 'running';

export default function StepDetectionScreen() {
  const [steps, setSteps] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityState>('idle');
  const [stepsPerMinute, setStepsPerMinute] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [accelData, setAccelData] = useState<{ x: number; y: number; z: number; mag: number }>({
    x: 0,
    y: 0,
    z: 0,
    mag: 0,
  });

  const [gyroData, setGyroData] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });

  const accelSubRef = useRef<Subscription | null>(null);
  const gyroSubRef = useRef<Subscription | null>(null);
  const lastStepTimeRef = useRef<number>(0);
  const recentStepTimesRef = useRef<number[]>([]);
  const isAboveThresholdRef = useRef<boolean>(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Umbrales de detección de pasos con acelerómetro
  const STEP_HIGH_THRESHOLD = 1.25; // Magnitud en g para considerar el pico del paso
  const STEP_LOW_THRESHOLD = 0.95;  // Magnitud en g para resetear el ciclo del paso
  const MIN_STEP_INTERVAL_MS = 320; // Evita contar doble un mismo paso (máx ~3 pasos/seg)

  const handleStep = useCallback(() => {
    const now = Date.now();
    const interval = now - lastStepTimeRef.current;
    lastStepTimeRef.current = now;

    setSteps((prev) => prev + 1);

    // Guardar timestamps de los pasos del último minuto para calcular pasos/min
    recentStepTimesRef.current.push(now);
    recentStepTimesRef.current = recentStepTimesRef.current.filter((t) => now - t < 60000);
    setStepsPerMinute(recentStepTimesRef.current.length);

    // Clasificar si está caminando o corriendo según el intervalo del paso
    if (interval < 460) {
      setActivity('running');
    } else {
      setActivity('walking');
    }

    // Reiniciar temporizador para volver a 'idle' si deja de moverse por 2.5 seg
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = setTimeout(() => {
      setActivity('idle');
      setStepsPerMinute(0);
    }, 2500);
  }, []);

  const startSensors = useCallback(() => {
    Accelerometer.setUpdateInterval(100);
    Gyroscope.setUpdateInterval(100);

    accelSubRef.current = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const mag = Math.sqrt(x * x + y * y + z * z);
      setAccelData({ x, y, z, mag });

      // Algoritmo de detección de picos (Zero/Threshold crossing)
      if (mag > STEP_HIGH_THRESHOLD && !isAboveThresholdRef.current) {
        const now = Date.now();
        if (now - lastStepTimeRef.current > MIN_STEP_INTERVAL_MS) {
          isAboveThresholdRef.current = true;
          handleStep();
        }
      } else if (mag < STEP_LOW_THRESHOLD) {
        isAboveThresholdRef.current = false;
      }
    });

    gyroSubRef.current = Gyroscope.addListener((data) => {
      setGyroData({ x: data.x, y: data.y, z: data.z });
    });
  }, [handleStep]);

  const stopSensors = useCallback(() => {
    if (accelSubRef.current) {
      accelSubRef.current.remove();
      accelSubRef.current = null;
    }
    if (gyroSubRef.current) {
      gyroSubRef.current.remove();
      gyroSubRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      startSensors();
    } else {
      stopSensors();
    }

    return () => {
      stopSensors();
    };
  }, [isActive, startSensors, stopSensors]);

  const resetCounter = () => {
    setSteps(0);
    setStepsPerMinute(0);
    setActivity('idle');
    lastStepTimeRef.current = 0;
    recentStepTimesRef.current = [];
  };

  const getActivityDetails = () => {
    switch (activity) {
      case 'running':
        return {
          title: 'Corriendo',
          emoji: '🏃‍♂️',
          badgeColor: '#EF4444',
          badgeBg: '#FEE2E2',
          textColor: '#991B1B',
        };
      case 'walking':
        return {
          title: 'Caminando',
          emoji: '🚶‍♂️',
          badgeColor: '#10B981',
          badgeBg: '#D1FAE5',
          textColor: '#065F46',
        };
      case 'idle':
      default:
        return {
          title: 'En reposo',
          emoji: '😴',
          badgeColor: '#6B7280',
          badgeBg: '#F3F4F6',
          textColor: '#374151',
        };
    }
  };

  const actDetails = getActivityDetails();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>ACTIVIDAD 2</Text>
          <Text style={styles.headerTitle}>Detector de Pasos</Text>
        </View>

        {/* Tarjeta Principal de Estado de Movimiento */}
        <View style={[styles.card, styles.activityCard, { borderColor: actDetails.badgeColor }]}>
          <View style={[styles.emojiCircle, { backgroundColor: actDetails.badgeBg }]}>
            <Text style={styles.emojiText}>{actDetails.emoji}</Text>
          </View>
          <Text style={styles.activityStateLabel}>ESTADO ACTUAL</Text>
          <Text style={[styles.activityStateTitle, { color: actDetails.textColor }]}>
            {actDetails.title}
          </Text>
          <View style={[styles.badge, { backgroundColor: actDetails.badgeBg }]}>
            <View style={[styles.dot, { backgroundColor: actDetails.badgeColor }]} />
            <Text style={[styles.badgeText, { color: actDetails.textColor }]}>
              {isActive ? 'Sensores activos' : 'Pausado'}
            </Text>
          </View>
        </View>

        {/* Métricas de Pasos y Cadencia */}
        <View style={styles.statsRow}>
          <View style={[styles.card, styles.statBox]}>
            <Text style={styles.statNumber}>{steps}</Text>
            <Text style={styles.statLabel}>PASOS TOTALES</Text>
          </View>

          <View style={[styles.card, styles.statBox]}>
            <Text style={styles.statNumber}>{stepsPerMinute}</Text>
            <Text style={styles.statLabel}>PASOS / MIN</Text>
          </View>
        </View>

        {/* Botones de Control */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, isActive ? styles.btnPause : styles.btnResume]}
            onPress={() => setIsActive(!isActive)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnTextPrimary}>
              {isActive ? '⏸️ Pausar' : '▶️ Iniciar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnReset]}
            onPress={resetCounter}
            activeOpacity={0.8}
          >
            <Text style={styles.btnTextSecondary}>🔄 Reiniciar</Text>
          </TouchableOpacity>
        </View>

        {/* Datos en Tiempo Real de Sensores */}
        <View style={[styles.card, styles.sensorCard]}>
          <Text style={styles.sensorSectionTitle}>📡 Datos de Sensores en Vivo</Text>
          
          {/* Acelerómetro */}
          <View style={styles.sensorItem}>
            <View style={styles.sensorHeader}>
              <Text style={styles.sensorName}>📱 Acelerómetro (g)</Text>
              <Text style={styles.sensorMag}>
                Mag: {accelData.mag.toFixed(2)} g
              </Text>
            </View>
            <View style={styles.axisGrid}>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>X</Text>
                <Text style={styles.axisValue}>{accelData.x.toFixed(2)}</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>Y</Text>
                <Text style={styles.axisValue}>{accelData.y.toFixed(2)}</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>Z</Text>
                <Text style={styles.axisValue}>{accelData.z.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Giroscopio */}
          <View style={styles.sensorItem}>
            <View style={styles.sensorHeader}>
              <Text style={styles.sensorName}>🔄 Giroscopio (rad/s)</Text>
            </View>
            <View style={styles.axisGrid}>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>X</Text>
                <Text style={styles.axisValue}>{gyroData.x.toFixed(2)}</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>Y</Text>
                <Text style={styles.axisValue}>{gyroData.y.toFixed(2)}</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>Z</Text>
                <Text style={styles.axisValue}>{gyroData.z.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E293B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  activityCard: {
    alignItems: 'center',
    borderWidth: 2,
    paddingVertical: 24,
  },
  emojiCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emojiText: {
    fontSize: 44,
  },
  activityStateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  activityStateTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 0,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPause: {
    backgroundColor: '#334155',
  },
  btnResume: {
    backgroundColor: '#4F46E5',
  },
  btnReset: {
    backgroundColor: '#E2E8F0',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnTextSecondary: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 15,
  },
  sensorCard: {
    padding: 18,
  },
  sensorSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 14,
  },
  sensorItem: {
    marginVertical: 4,
  },
  sensorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sensorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  sensorMag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  axisGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  axisItem: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  axisValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
});
