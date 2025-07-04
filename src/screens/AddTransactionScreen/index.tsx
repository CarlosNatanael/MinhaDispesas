import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../App';
import { Transaction, TransactionType, TransactionStatus } from '../../types';
import { addTransactionToAsyncStorage, getTransactionsFromAsyncStorage, updateTransactionInAsyncStorage } from '../../data/transactions';
import { v4 as uuidv4 } from 'uuid';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

// Tipando as props de rota
type AddTransactionScreenRouteProp = RouteProp<RootStackParamList, 'AddTransaction'>;
type AddTransactionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddTransaction'>;


const CATEGORIES = [
  'Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação',
  'Contas', 'Salário', 'Compras', 'Cartão', 'Outros', 'Esporte', 'Pets', 'Família'
];

const INSTALLMENT_FREQUENCIES = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'];

const AddTransactionScreen: React.FC = () => {
  const navigation = useNavigation<AddTransactionScreenNavigationProp>();
  const route = useRoute<AddTransactionScreenRouteProp>();

  const [id, setId] = useState(uuidv4());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [status, setStatus] = useState<TransactionStatus>('paid');

  const [frequency, setFrequency] = useState<'once' | 'installment' | 'monthly'>('once');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentFrequency, setInstallmentFrequency] = useState(INSTALLMENT_FREQUENCIES[0]);

  useEffect(() => {
    const loadTransactionForEdit = async () => {

      if (route.params?.transactionId) {
        const transactionToEdit = (await getTransactionsFromAsyncStorage()).find(t => t.id === route.params?.transactionId);
        
        if (transactionToEdit) {
          setId(transactionToEdit.id);
          setDescription(transactionToEdit.description);
          setAmount(transactionToEdit.amount.toString().replace('.', ','));
          setCategory(transactionToEdit.category);
          setType(transactionToEdit.type);
          setDate(new Date(transactionToEdit.date));
          setFrequency(transactionToEdit.frequency);
          setStatus(transactionToEdit.status);

          if (transactionToEdit.frequency === 'installment') {
            setTotalInstallments(transactionToEdit.totalInstallments?.toString() || '');
            setTotalAmount(transactionToEdit.totalAmount?.toFixed(2).replace('.', ',') || '');
            setInstallmentFrequency(transactionToEdit.installmentFrequency || INSTALLMENT_FREQUENCIES[0]);
          }
        } else {
          Alert.alert('Erro', 'Lançamento não encontrado para edição.');
          navigation.goBack();
        }
      }
    };
    loadTransactionForEdit();
  }, [route.params?.transactionId, navigation]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleSaveTransaction = async () => {

    const parsedAmount = parseFloat(amount.replace(',', '.'));

    if (!description || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Erro', 'Preencha a descrição e um valor válido.');
      return;
    }

    const formattedDate = date.toISOString().split('T')[0];

    let transactionToSave: Transaction = {
      id: uuidv4(),
      // userId: userId, // REMOVER userId
      description,
      amount: parsedAmount,
      date: formattedDate,
      category,
      type,
      status: status,
      frequency,
    };

    if (frequency === 'installment') {
      const parsedTotalInstallments = parseInt(totalInstallments);
      const parsedTotalAmount = parseFloat(totalAmount.replace(',', '.'));

      if (isNaN(parsedTotalInstallments) || parsedTotalInstallments <= 0) {
        Alert.alert('Erro', 'Preencha o número de parcelas válido.');
        return;
      }
      if (isNaN(parsedTotalAmount) || parsedTotalAmount <= 0) {
        Alert.alert('Erro', 'Preencha o valor total da compra válido.');
        return;
      }

      transactionToSave = {
        ...transactionToSave,
        amount: parsedAmount,
        totalAmount: parsedTotalAmount,
        totalInstallments: parsedTotalInstallments,
        currentInstallment: transactionToSave.currentInstallment || 1,
        originalPurchaseDate: transactionToSave.originalPurchaseDate || formattedDate,
        installmentGroupId: transactionToSave.installmentGroupId || uuidv4(),
        installmentFrequency: installmentFrequency,
      };
    } else if (frequency === 'monthly') {
      transactionToSave = {
        ...transactionToSave,
        startDate: transactionToSave.startDate || formattedDate,
      };
    }

    try {
      if (route.params?.transactionId) {
        const existingTransId = route.params.transactionId;
        const updatedTransWithId: Transaction = { ...transactionToSave, id: existingTransId };
        await updateTransactionInAsyncStorage(updatedTransWithId);
        Toast.show({ type: 'success', text1: 'Sucesso!', text2: 'Lançamento atualizado com êxito.', visibilityTime: 2000, autoHide: true, topOffset: 30 });
      } else {
        await addTransactionToAsyncStorage(transactionToSave);
        Toast.show({ type: 'success', text1: 'Sucesso!', text2: 'Lançamento salvo com êxito.', visibilityTime: 2000, autoHide: true, topOffset: 30 });
      }
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao salvar/atualizar transação:', error);
      Alert.alert('Erro', 'Não foi possível salvar/atualizar o lançamento.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>{route.params?.transactionId ? 'Editar Lançamento' : 'Novo Lançamento'}</Text>

      {/* Tipo de Lançamento (Receita/Despesa) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tipo de Lançamento</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'expense' && styles.selectedTypeButton]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeButtonText, type === 'expense' && styles.selectedTypeButtonText]}>Despesa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'income' && styles.selectedTypeButton]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeButtonText, type === 'income' && styles.selectedTypeButtonText]}>Receita</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status (Pago / A Pagar) */}
      {type === 'expense' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Status da Despesa</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, status === 'paid' && styles.selectedTypeButton]}
              onPress={() => setStatus('paid')}
            >
              <Text style={[styles.typeButtonText, status === 'paid' && styles.selectedTypeButtonText]}>Pago</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, status === 'pending' && styles.selectedTypeButton]}
              onPress={() => setStatus('pending')}
            >
              <Text style={[styles.typeButtonText, status === 'pending' && styles.selectedTypeButtonText]}>A Pagar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Descrição */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Almoço com amigos"
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Valor (Individual da Parcela, ou Único/Recorrente) */}
      {frequency !== 'installment' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor</Text>
          <TextInput
            style={styles.input}
            placeholder="R$ 0,00"
            keyboardType="numeric"
            value={amount}
            onChangeText={text => setAmount(text.replace('.', ',').replace(/[^0-9,]/g, ''))}
          />
        </View>
      )}

      {/* Categoria */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Categoria</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            onValueChange={(itemValue: string) => setCategory(itemValue)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {CATEGORIES.map((cat) => (
              <Picker.Item key={cat} label={cat} value={cat} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Data */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Data</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
          <Text style={styles.datePickerText}>{date.toLocaleDateString('pt-BR')}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            testID="datePicker"
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}
      </View>

      {/* Frequência (Única, Parcelada, Recorrente) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Frequência</Text>
        <View style={styles.frequencySelector}>
          <TouchableOpacity
            style={[styles.frequencyButton, frequency === 'once' && styles.selectedFrequencyButton]}
            onPress={() => setFrequency('once')}
          >
            <Text style={[styles.frequencyButtonText, frequency === 'once' && styles.selectedFrequencyButtonText]}>Única</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.frequencyButton, frequency === 'installment' && styles.selectedFrequencyButton]}
            onPress={() => setFrequency('installment')}
          >
            <Text style={[styles.frequencyButtonText, frequency === 'installment' && styles.selectedFrequencyButtonText]}>Parcelada</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.frequencyButton, frequency === 'monthly' && styles.selectedFrequencyButton]}
            onPress={() => setFrequency('monthly')}
          >
            <Text style={[styles.frequencyButtonText, frequency === 'monthly' && styles.selectedFrequencyButtonText]}>Recorrente</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Campos Condicionais para Frequência */}
      {frequency === 'installment' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Valor da Parcela</Text>
            <TextInput
              style={styles.input}
              placeholder="R$ 0,00"
              keyboardType="numeric"
              value={amount}
              onChangeText={text => setAmount(text.replace('.', ',').replace(/[^0-9,]/g, ''))}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Valor Total da Compra</Text>
            <TextInput
              style={styles.input}
              placeholder="R$ 0,00"
              keyboardType="numeric"
              value={totalAmount}
              onChangeText={text => setTotalAmount(text.replace('.', ',').replace(/[^0-9,]/g, ''))}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de Parcelas</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 12"
              keyboardType="numeric"
              value={totalInstallments}
              onChangeText={text => setTotalInstallments(text.replace(/[^0-9]/g, ''))}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Frequência da Parcela</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={installmentFrequency}
                onValueChange={(itemValue: string) => setInstallmentFrequency(itemValue)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {INSTALLMENT_FREQUENCIES.map((freq) => (
                  <Picker.Item key={freq} label={
                    freq === 'monthly' ? 'Mensal' :
                    freq === 'bimonthly' ? 'Bimestral' :
                    freq === 'quarterly' ? 'Trimestral' :
                    freq === 'semiannual' ? 'Semestral' :
                    freq === 'yearly' ? 'Anual' : freq
                  } value={freq} />
                ))}
              </Picker>
            </View>
          </View>
        </>
      )}
      {/* Salvar Botão */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction}>
        <Text style={styles.saveButtonText}>Salvar Lançamento</Text>
      </TouchableOpacity>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    marginTop: 15,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectedTypeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 7,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  selectedTypeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  pickerItem: {
    fontSize: 16,
  },
  datePickerButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  frequencySelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectedFrequencyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 7,
  },
  frequencyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  selectedFrequencyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#28A745',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default AddTransactionScreen;