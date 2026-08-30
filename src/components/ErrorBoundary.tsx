import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import Colors from '../constants/Colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[SheDrive ErrorBoundary] Caught UI crash:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected runtime error occurred.';
      const errorStack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>🛡️</Text>
              </View>
              <Text style={styles.title}>Something Went Wrong</Text>
              <Text style={styles.subtitle}>
                SheDrive encountered an unexpected issue, but your session and safety data are protected.
              </Text>

              {/* Collapsible Runtime Diagnostics Panel */}
              <View style={styles.debugBox}>
                <View style={styles.debugHeader}>
                  <Text style={styles.debugTitle}>⚠️ Diagnostic Details</Text>
                  <TouchableOpacity onPress={this.toggleDetails} activeOpacity={0.7} style={styles.toggleBtn}>
                    <Text style={styles.toggleBtnText}>{this.state.showDetails ? 'Hide Details ▲' : 'View Details ▼'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.debugErrorMsg} numberOfLines={this.state.showDetails ? undefined : 3}>
                  {errorMessage}
                </Text>
                {this.state.showDetails && (
                  <View style={styles.stackBox}>
                    {errorStack ? (
                      <Text style={styles.stackText}>
                        <Text style={{ fontWeight: '700' }}>Stack Trace:{'\n'}</Text>
                        {errorStack}
                      </Text>
                    ) : null}
                    {componentStack ? (
                      <Text style={styles.stackText}>
                        {'\n'}
                        <Text style={{ fontWeight: '700' }}>Component Trace:{'\n'}</Text>
                        {componentStack}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
                <Text style={styles.buttonText}>Restart Application Screen</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  debugBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  toggleBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  debugErrorMsg: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  stackText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
