import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBudgetsStore } from '../../stores/useBudgetsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency } from '../../lib/derived';
import type { BudgetWithSpent, CreateBudgetInput } from '../../types';

export default function BudgetScreen() {
  const { budgets, load, add, remove } = useBudgetsStore();
  const { categories, getCategoryById } = useCategoriesStore();
  const { settings } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const sym = settings.currencySymbol;

  useEffect(() => {
    load(settings.yearStart);
  }, [settings.yearStart]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(settings.yearStart);
    setRefreshing(false);
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.spent > b.amount).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F0F5' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#0A0A0A' }}>Budgets</Text>
        </View>

        {/* Summary */}
        {budgets.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>BUDGETED</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#0A0A0A', marginTop: 4 }}>
                  {formatCurrency(totalBudgeted, sym)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>SPENT</Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: totalSpent > totalBudgeted ? '#DC2626' : '#0A0A0A',
                    marginTop: 4,
                  }}
                >
                  {formatCurrency(totalSpent, sym)}
                </Text>
              </View>
            </View>
            {overBudgetCount > 0 && (
              <View
                style={{
                  backgroundColor: '#FEE2E2',
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="warning" size={16} color="#DC2626" />
                <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: '500' }}>
                  {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} over budget
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Budget list */}
        <View style={{ paddingHorizontal: 16 }}>
          {budgets.length === 0 ? (
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 32,
                alignItems: 'center',
              }}
            >
              <Ionicons name="pricetag-outline" size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', fontSize: 15, fontWeight: '500', marginTop: 12 }}>
                No budgets yet
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Set spending limits for categories to track your budget
              </Text>
            </View>
          ) : (
            budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                sym={sym}
                onDelete={() => {
                  Alert.alert('Delete budget?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove(budget.id) },
                  ]);
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#1B4332',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Add Budget Modal */}
      <AddBudgetModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={async (data) => {
          await add(data, settings.yearStart);
          setShowAddModal(false);
        }}
      />
    </SafeAreaView>
  );
}

function BudgetCard({
  budget,
  sym,
  onDelete,
}: {
  budget: BudgetWithSpent;
  sym: string;
  onDelete: () => void;
}) {
  const isOver = budget.spent > budget.amount;
  const barColor = isOver ? '#DC2626' : budget.percent > 75 ? '#B45309' : '#1B4332';

  return (
    <TouchableOpacity
      onLongPress={onDelete}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: budget.categoryColor + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={budget.categoryIcon as any} size={18} color={budget.categoryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#0A0A0A' }}>
            {budget.categoryName}
          </Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            {budget.period === 'month' ? 'Monthly' : 'Yearly'} budget
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: isOver ? '#DC2626' : '#0A0A0A' }}>
            {formatCurrency(budget.spent, sym)}
          </Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            of {formatCurrency(budget.amount, sym)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
        <View
          style={{
            height: 6,
            width: `${Math.min(budget.percent, 100)}%`,
            backgroundColor: barColor,
            borderRadius: 3,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 12, color: isOver ? '#DC2626' : '#9CA3AF' }}>
          {isOver
            ? `${formatCurrency(budget.spent - budget.amount, sym)} over`
            : `${formatCurrency(budget.remaining, sym)} left`}
        </Text>
        <Text style={{ fontSize: 12, color: isOver ? '#DC2626' : '#9CA3AF' }}>
          {budget.percent}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function AddBudgetModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateBudgetInput) => Promise<void>;
}) {
  const { categories } = useCategoriesStore();
  const { settings } = useUIStore();
  const sym = settings.currencySymbol;

  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(false);

  const outCategories = categories.filter((c) => c.type !== 'in');

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!amount || !categoryId) return;
    setLoading(true);
    try {
      await onSave({
        categoryId,
        amount,
        period,
        startDate: new Date().toISOString(),
      });
      setAmountStr('');
      setCategoryId('');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#F0F0F5', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#0A0A0A' }}>New Budget</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Budget amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, color: '#9CA3AF', marginRight: 4 }}>{sym}</Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                autoFocus
                style={{ fontSize: 24, fontWeight: '700', color: '#1B4332', flex: 1 }}
              />
            </View>
          </View>

          {/* Category */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {outCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    marginRight: 8,
                    backgroundColor: categoryId === cat.id ? '#1B4332' : '#fff',
                    borderWidth: 1,
                    borderColor: categoryId === cat.id ? '#1B4332' : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontSize: 13, color: categoryId === cat.id ? '#fff' : '#6B7280' }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Period */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            {(['month', 'year'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: period === p ? '#1B4332' : '#fff',
                  borderWidth: 1,
                  borderColor: period === p ? '#1B4332' : '#E5E7EB',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: period === p ? '#fff' : '#6B7280' }}>
                  {p === 'month' ? 'Monthly' : 'Yearly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!amountStr || !categoryId || loading}
            style={{
              backgroundColor: amountStr && categoryId ? '#1B4332' : '#9CA3AF',
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Add Budget</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
