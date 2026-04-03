import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  icon?: 'info' | 'error' | 'success' | 'warning';
  onClose: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  icon = 'info',
  onClose,
}: CustomAlertProps) {
  const { theme } = useTheme();

  const getIconConfig = () => {
    switch (icon) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: theme.success };
      case 'error':
        return { name: 'close-circle' as const, color: theme.error };
      case 'warning':
        return { name: 'warning' as const, color: theme.error };
      default:
        return { name: 'information-circle' as const, color: theme.primary };
    }
  };

  const iconConfig = getIconConfig();

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.alertContainer, { backgroundColor: theme.card }]}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconConfig.name} size={48} color={iconConfig.color} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          <ScrollView style={styles.messageContainer} showsVerticalScrollIndicator={false}>
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          </ScrollView>

          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  {
                    backgroundColor:
                      button.style === 'destructive'
                        ? theme.error
                        : button.style === 'cancel'
                        ? theme.card
                        : theme.primary,
                    borderWidth: button.style === 'cancel' ? 2 : 0,
                    borderColor: button.style === 'cancel' ? theme.border : 'transparent',
                  },
                  buttons.length > 1 && index < buttons.length - 1 && styles.buttonMargin,
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color:
                        button.style === 'cancel'
                          ? theme.text
                          : theme.buttonText,
                      fontWeight: button.style === 'destructive' ? 'bold' : '600',
                    },
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  messageContainer: {
    maxHeight: 200,
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonMargin: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
  },
});
