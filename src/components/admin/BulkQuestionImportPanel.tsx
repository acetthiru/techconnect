import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Check, 
  RefreshCw, 
  Layers, 
  ArrowRight, 
  Download, 
  Sparkles, 
  Grid, 
  ListFilter,
  HelpCircle,
  Database,
  FileCheck
} from 'lucide-react';
import { ImportReviewItem, RoundNumber, QuestionSet } from '../../types';

interface BulkQuestionImportPanelProps {
  adminToken: string | null;
  onQuestionsImported: () => void;
}

export const BulkQuestionImportPanel: React.FC<BulkQuestionImportPanelProps> = ({
  adminToken,
  onQuestionsImported,
}) => {
  const [importMode, setImportMode] = useState<'ALL_ROUNDS' | 'SINGLE_TARGET'>('ALL_ROUNDS');
  const [inputText, setInputText] = useState<string>('');
  const [detectedFormat, setDetectedFormat] = useState<'AUTO' | 'JSON' | 'TEXT' | 'CSV'>('AUTO');
  const [defaultRound, setDefaultRound] = useState<RoundNumber>(1);
  const [defaultSet, setDefaultSet] = useState<QuestionSet>('A');
  const [replaceMode, setReplaceMode] = useState<'APPEND' | 'REPLACE_MATCHING' | 'REPLACE_ALL'>('APPEND');
  
  const [parsing, setParsing] = useState(false);
  const [directInserting, setDirectInserting] = useState(false);
  const [validatingSchema, setValidatingSchema] = useState(false);
  const [validationData, setValidationData] = useState<{
    valid: boolean;
    totalQuestions: number;
    validCount: number;
    invalidCount: number;
    errors: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }>;
    warnings: Array<{ index: number; questionNumber?: number; title?: string; field: string; message: string }>;
    matrix?: Record<string, Record<string, number>>;
    message?: string;
  } | null>(null);
  const [queue, setQueue] = useState<ImportReviewItem[]>([]);
  const [filterRound, setFilterRound] = useState<string>('ALL');
  const [filterSet, setFilterSet] = useState<string>('ALL');
  const [editingItem, setEditingItem] = useState<ImportReviewItem | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [parsedMatrix, setParsedMatrix] = useState<Record<string, Record<string, number>> | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/admin/questions/review-queue', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchQueue();
    }
  }, [adminToken]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      if (file.name.endsWith('.json')) setDetectedFormat('JSON');
      else if (file.name.endsWith('.csv')) setDetectedFormat('CSV');
      else setDetectedFormat('TEXT');
    };
    reader.readAsText(file);
  };

  // Sample Multi-Round Master JSON Template Generator
  const generateAllRoundsSampleJSON = () => {
    const sample = {
      description: "TECH BRIDGE '26 - Complete Competition Question Master Pack",
      questions: [
        // ROUND 1 - SET A
        { round: 1, set: "A", questionNumber: 1, title: "Deadlock Detection", correctAnswer: "Deadlock", aliases: ["Dead Lock", "Resource Deadlock"], points: 1, domain: "Operating Systems", explanation: "Two competing actions waiting for each other to finish." },
        { round: 1, set: "A", questionNumber: 2, title: "Firewall Security", correctAnswer: "Firewall", aliases: ["Network Firewall"], points: 1, domain: "Network Security", explanation: "Network security system monitoring incoming and outgoing traffic." },
        { round: 1, set: "A", questionNumber: 3, title: "Binary Search Tree", correctAnswer: "Binary Search", aliases: ["BST", "Binary Search Algorithm"], points: 1, domain: "Data Structures", explanation: "Logarithmic time lookup algorithm on sorted elements." },
        { round: 1, set: "A", questionNumber: 4, title: "Cloud Computing", correctAnswer: "Cloud Storage", aliases: ["Cloud", "Cloud Computing"], points: 1, domain: "Cloud Architecture", explanation: "On-demand availability of computer system resources." },
        { round: 1, set: "A", questionNumber: 5, title: "Database Index", correctAnswer: "B-Tree", aliases: ["B Tree", "BTree Index"], points: 1, domain: "Databases", explanation: "Self-balancing tree data structure used in database indexes." },

        // ROUND 1 - SET B
        { round: 1, set: "B", questionNumber: 1, title: "Cache Memory", correctAnswer: "Cache Memory", aliases: ["Cache", "CPU Cache"], points: 1, domain: "Computer Architecture", explanation: "High-speed volatile computer data storage." },
        { round: 1, set: "B", questionNumber: 2, title: "Garbage Collection", correctAnswer: "Garbage Collector", aliases: ["GC", "Garbage Collection"], points: 1, domain: "Programming Runtimes", explanation: "Automatic memory management freeing unreferenced memory." },
        { round: 1, set: "B", questionNumber: 3, title: "Hash Collision", correctAnswer: "Hash Collision", aliases: ["Collision", "Hash Conflict"], points: 1, domain: "Algorithms", explanation: "When two distinct keys produce the identical hash code." },
        { round: 1, set: "B", questionNumber: 4, title: "Virtual DOM", correctAnswer: "Virtual DOM", aliases: ["VDOM", "Virtual Document Object Model"], points: 1, domain: "Web Technologies", explanation: "In-memory representation of real UI DOM in modern frameworks." },
        { round: 1, set: "B", questionNumber: 5, title: "Zero Day Exploit", correctAnswer: "Zero Day", aliases: ["0-Day", "Zero Day Vulnerability"], points: 1, domain: "Cybersecurity", explanation: "Undisclosed flaw unknown to the vendor." },

        // ROUND 1 - SET C
        { round: 1, set: "C", questionNumber: 1, title: "Stack Overflow", correctAnswer: "Stack Overflow", aliases: ["Call Stack Overflow"], points: 1, domain: "Software Engineering", explanation: "Excessive call stack memory allocation in recursive loops." },
        { round: 1, set: "C", questionNumber: 2, title: "Race Condition", correctAnswer: "Race Condition", aliases: ["Data Race", "Concurrency Hazard"], points: 1, domain: "Concurrency", explanation: "Device or system attempting to perform operations concurrently." },
        { round: 1, set: "C", questionNumber: 3, title: "Asymmetric Encryption", correctAnswer: "RSA Algorithm", aliases: ["RSA", "Public Key Cryptography"], points: 1, domain: "Cryptography", explanation: "Public-key cryptosystem widely used for secure data transmission." },
        { round: 1, set: "C", questionNumber: 4, title: "Containerization", correctAnswer: "Docker Container", aliases: ["Docker", "Container"], points: 1, domain: "DevOps", explanation: "OS-level virtualization delivering software in packages." },
        { round: 1, set: "C", questionNumber: 5, title: "Dynamic Programming", correctAnswer: "Memoization", aliases: ["DP Memoization", "Memo Table"], points: 1, domain: "Algorithms", explanation: "Optimization technique caching results of expensive function calls." },

        // ROUND 2 - SET A
        { round: 2, set: "A", questionNumber: 1, title: "Distributed Consensus", correctAnswer: "Raft Consensus", aliases: ["Raft", "Paxos Consensus"], points: 2, domain: "Distributed Systems", explanation: "Consensus algorithm designed to be easy to understand." },
        { round: 2, set: "A", questionNumber: 2, title: "Neural Network Weights", correctAnswer: "Backpropagation", aliases: ["Backprop", "Gradient Descent"], points: 2, domain: "Artificial Intelligence", explanation: "Algorithm for computing gradient of loss function in neural nets." },
        { round: 2, set: "A", questionNumber: 3, title: "Database Sharding", correctAnswer: "Database Sharding", aliases: ["Sharding", "Horizontal Partitioning"], points: 2, domain: "Databases", explanation: "Horizontal partition of data in a database or search engine." },
        { round: 2, set: "A", questionNumber: 4, title: "Microservices Gateway", correctAnswer: "API Gateway", aliases: ["Reverse Proxy", "Gateway Proxy"], points: 2, domain: "System Design", explanation: "Single entry point for all clients in microservices architecture." },
        { round: 2, set: "A", questionNumber: 5, title: "Zero Knowledge Proof", correctAnswer: "Zero Knowledge Proof", aliases: ["ZKP", "zk-SNARK"], points: 2, domain: "Cryptography", explanation: "Proving knowledge of a value without conveying any other info." },

        // ROUND 2 - SET B
        { round: 2, set: "B", questionNumber: 1, title: "Kafka Event Streaming", correctAnswer: "Event Streaming", aliases: ["Apache Kafka", "Message Broker"], points: 2, domain: "Distributed Systems", explanation: "Capturing data in real-time from event sources like databases." },
        { round: 2, set: "B", questionNumber: 2, title: "Transformer Self-Attention", correctAnswer: "Self Attention", aliases: ["Transformer Attention", "Multi-Head Attention"], points: 2, domain: "Deep Learning", explanation: "Mechanism relating different positions of a single sequence." },
        { round: 2, set: "B", questionNumber: 3, title: "Bloom Filter Probabilistic", correctAnswer: "Bloom Filter", aliases: ["Probabilistic Filter"], points: 2, domain: "Data Structures", explanation: "Space-efficient probabilistic data structure checking set membership." },
        { round: 2, set: "B", questionNumber: 4, title: "Load Balancer Algorithm", correctAnswer: "Consistent Hashing", aliases: ["Consistent Hash Ring"], points: 2, domain: "System Design", explanation: "Special hashing technique that minimizes reorganization on server resize." },
        { round: 2, set: "B", questionNumber: 5, title: "Serverless Cold Start", correctAnswer: "Cold Start", aliases: ["Serverless Latency", "Lambda Cold Start"], points: 2, domain: "Cloud Architecture", explanation: "Initial latency when executing serverless container for first time." },

        // ROUND 2 - SET C
        { round: 2, set: "C", questionNumber: 1, title: "CRDT Collaborative Sync", correctAnswer: "CRDT", aliases: ["Conflict-free Replicated Data Type"], points: 2, domain: "Distributed Systems", explanation: "Data structure replicated across computers without central coordination." },
        { round: 2, set: "C", questionNumber: 2, title: "Vector Embeddings", correctAnswer: "Vector Database", aliases: ["Vector DB", "Embeddings Index"], points: 2, domain: "AI Systems", explanation: "Database indexing and retrieving high-dimensional dense vectors." },
        { round: 2, set: "C", questionNumber: 3, title: "Circuit Breaker Pattern", correctAnswer: "Circuit Breaker", aliases: ["Resilience4j Pattern"], points: 2, domain: "Microservices", explanation: "Prevents an application from repeatedly trying to execute failing calls." },
        { round: 2, set: "C", questionNumber: 4, title: "WebAssembly Bytecode", correctAnswer: "WebAssembly", aliases: ["WASM", "Web Assembly"], points: 2, domain: "Web Engineering", explanation: "Binary instruction format for a stack-based virtual machine." },
        { round: 2, set: "C", questionNumber: 5, title: "Quantum Entanglement Gate", correctAnswer: "Hadamard Gate", aliases: ["Quantum Gate", "Qubit Superposition"], points: 2, domain: "Quantum Computing", explanation: "Fundamental single-qubit quantum gate creating superposition states." },

        // ROUND 3 - SET A
        { round: 3, set: "A", questionNumber: 1, title: "CAP Theorem Tradeoff", correctAnswer: "CAP Theorem", aliases: ["Brewer's Theorem", "Consistency Availability Partition"], points: 3, domain: "Distributed Theory", explanation: "Impossible for distributed system to simultaneously provide all three guarantees." },
        { round: 3, set: "A", questionNumber: 2, title: "BFT Consensus Network", correctAnswer: "Byzantine Fault Tolerance", aliases: ["BFT", "Practical BFT"], points: 3, domain: "Fault Tolerant Systems", explanation: "System dependability despite arbitrary traitor node failures." },
        { round: 3, set: "A", questionNumber: 3, title: "Diffusion Denoising Model", correctAnswer: "Diffusion Model", aliases: ["DDPM", "Stable Diffusion"], points: 3, domain: "Generative AI", explanation: "Generative model generating data by gradually denoising random noise." },

        // ROUND 3 - SET B
        { round: 3, set: "B", questionNumber: 1, title: "LSM Tree Storage Engine", correctAnswer: "LSM Tree", aliases: ["Log-Structured Merge Tree", "LevelDB Engine"], points: 3, domain: "Storage Engines", explanation: "Data structure with great write throughput used in Cassandra and RocksDB." },
        { round: 3, set: "B", questionNumber: 2, title: "Speculative Branch Predictor", correctAnswer: "Branch Predictor", aliases: ["Speculative Execution", "Spectre Mitigation"], points: 3, domain: "Hardware Architecture", explanation: "Digital circuit trying to guess branch directions before definitive computation." },
        { round: 3, set: "B", questionNumber: 3, title: "Retrieval-Augmented Generation", correctAnswer: "RAG Architecture", aliases: ["RAG", "Retrieval Augmented Generation"], points: 3, domain: "AI Architecture", explanation: "Grounding LLM prompts with external dynamic vector database context." },

        // ROUND 3 - SET C
        { round: 3, set: "C", questionNumber: 1, title: "Two-Phase Commit Protocol", correctAnswer: "Two Phase Commit", aliases: ["2PC", "Distributed Transaction Protocol"], points: 3, domain: "Distributed Transactions", explanation: "Atomic commitment protocol guaranteeing atomicity across distributed nodes." },
        { round: 3, set: "C", questionNumber: 2, title: "Zero Trust Architecture", correctAnswer: "Zero Trust", aliases: ["Zero Trust Security", "Never Trust Always Verify"], points: 3, domain: "Cybersecurity", explanation: "Security framework requiring strict verification for every device and user." },
        { round: 3, set: "C", questionNumber: 3, title: "Mixture of Experts", correctAnswer: "Mixture of Experts", aliases: ["MoE", "Sparse MoE Architecture"], points: 3, domain: "Advanced Machine Learning", explanation: "Ensemble learning technique activating sub-networks conditionally per token." }
      ]
    };

    setInputText(JSON.stringify(sample, null, 2));
    setDetectedFormat('JSON');
    setMessage({ type: 'success', text: 'Loaded Complete 3-Round & 3-Set Competition Master Template into editor!' });
  };

  const generateAllRoundsSampleCSV = () => {
    const csvContent = `round,set,questionNumber,correctAnswer,title,clue1,clue2,points,domain,aliases,explanation
1,A,1,Deadlock,Deadlock Detection,Processes Waiting,Circular Resource Dependency,1,Operating Systems,Dead Lock;Resource Stall,Two competing actions waiting for each other to finish.
1,A,2,Firewall,Firewall Security,Network Gate,Traffic Filtering Barrier,1,Network Security,Network Firewall,Network security system monitoring incoming and outgoing traffic.
1,A,3,Binary Search,Binary Search Tree,Divide and Conquer,Sorted Array Search,1,Data Structures,BST;Binary Search Algorithm,Logarithmic time lookup algorithm on sorted elements.
1,B,1,Cache Memory,Cache Memory,High-Speed SRAM,CPU Memory Buffer,1,Computer Architecture,Cache;CPU Cache,High-speed volatile computer data storage.
1,B,2,Garbage Collector,Garbage Collection,Automated Memory Release,Heap Sweeper,1,Programming Runtimes,GC;Garbage Collection,Automatic memory management freeing unreferenced memory.
1,C,1,Stack Overflow,Stack Overflow,Infinite Recursion,Call Stack Memory Leak,1,Software Engineering,Call Stack Overflow,Excessive call stack memory allocation in recursive loops.
1,C,2,Docker Container,Containerization,App Packaging Box,Isolated OS Runtime,1,DevOps,Docker;Container,OS-level virtualization delivering software in packages.
2,A,1,Raft Consensus,Distributed Consensus,Leader Election,Replicated State Machine,2,Distributed Systems,Raft;Paxos Consensus,Consensus algorithm designed to be easy to understand.
2,A,2,Backpropagation,Neural Network Weights,Gradient Descent,Loss Error Propagation,2,Artificial Intelligence,Backprop;Gradient Descent,Algorithm for computing gradient of loss function in neural nets.
2,B,1,Event Streaming,Kafka Event Streaming,Real-Time Topic Stream,Distributed Commit Log,2,Distributed Systems,Apache Kafka;Message Broker,Capturing data in real-time from event sources.
2,B,2,Self Attention,Transformer Self-Attention,Query Key Value Vectors,Token Context Weighting,2,Deep Learning,Transformer Attention;Multi-Head Attention,Mechanism relating different positions of a single sequence.
2,C,1,CRDT,CRDT Collaborative Sync,Conflict-Free Merging,P2P Document Sync,2,Distributed Systems,Conflict-free Replicated Data Type,Data structure replicated across computers without coordination.
2,C,2,Vector Database,Vector Embeddings,High-Dimensional KNN,Dense Embedding Search,2,AI Systems,Vector DB;Embeddings Index,Database indexing and retrieving high-dimensional dense vectors.
3,A,1,CAP Theorem,CAP Theorem Tradeoff,Consistency vs Availability,Partition Tolerance Limit,3,Distributed Theory,Brewer's Theorem;CAP,Impossible for distributed system to simultaneously guarantee all three.
3,A,2,Byzantine Fault Tolerance,BFT Consensus Network,Traitor General Problem,Malicious Node Tolerance,3,Fault Tolerant Systems,BFT;Practical BFT,System dependability despite arbitrary traitor node failures.
3,B,1,LSM Tree,LSM Tree Storage Engine,MemTable Flush,SSTable Compaction,3,Storage Engines,Log-Structured Merge Tree;LevelDB Engine,Data structure with great write throughput.
3,C,1,Two Phase Commit,Two-Phase Commit Protocol,Prepare Phase,Commit Phase Coordinator,3,Distributed Transactions,2PC;Distributed Transaction Protocol,Atomic commitment protocol across distributed nodes.`;

    setInputText(csvContent);
    setDetectedFormat('CSV');
    setMessage({ type: 'success', text: 'Loaded Complete Multi-Round Master CSV template into editor!' });
  };

  const downloadTemplate = (format: 'JSON' | 'CSV') => {
    let content = '';
    let filename = '';
    let mime = '';

    if (format === 'JSON') {
      const sample = {
        title: "TECH_BRIDGE_26_ALL_ROUNDS_QUESTION_BANK",
        questions: [
          { round: 1, set: "A", questionNumber: 1, title: "Deadlock Detection", correctAnswer: "Deadlock", aliases: ["Dead Lock"], points: 1, domain: "Operating Systems", clue1: "Process Waiting", clue2: "Resource Lock", explanation: "Operating system deadlock condition." },
          { round: 1, set: "B", questionNumber: 1, title: "CPU Cache Memory", correctAnswer: "Cache Memory", aliases: ["CPU Cache"], points: 1, domain: "Architecture", clue1: "SRAM Chip", clue2: "L1 L2 Cache", explanation: "High speed CPU cache memory." },
          { round: 1, set: "C", questionNumber: 1, title: "Stack Overflow", correctAnswer: "Stack Overflow", aliases: ["Call Stack"], points: 1, domain: "Software", clue1: "Infinite Recursion", clue2: "Stack Memory", explanation: "Exhaustion of call stack memory." },
          { round: 2, set: "A", questionNumber: 1, title: "Distributed Consensus", correctAnswer: "Raft Consensus", aliases: ["Raft"], points: 2, domain: "Distributed", clue1: "Leader Election", clue2: "Log Replication", explanation: "Raft consensus algorithm." },
          { round: 2, set: "B", questionNumber: 1, title: "Apache Kafka Streaming", correctAnswer: "Event Streaming", aliases: ["Kafka"], points: 2, domain: "Data Streams", clue1: "Message Queue", clue2: "Pub Sub Broker", explanation: "High throughput event streaming." },
          { round: 2, set: "C", questionNumber: 1, title: "Vector DB Embeddings", correctAnswer: "Vector Database", aliases: ["Vector DB"], points: 2, domain: "AI Systems", clue1: "Embeddings Space", clue2: "Cosine Similarity", explanation: "Vector index for AI retrieval." },
          { round: 3, set: "A", questionNumber: 1, title: "CAP Theorem", correctAnswer: "CAP Theorem", aliases: ["Brewer's Theorem"], points: 3, domain: "Distributed Theory", clue1: "Consistency", clue2: "Availability", explanation: "CAP theorem distributed database tradeoff." },
          { round: 3, set: "B", questionNumber: 1, title: "LSM Tree Engine", correctAnswer: "LSM Tree", aliases: ["Log Structured Merge"], points: 3, domain: "Databases", clue1: "MemTable", clue2: "SSTable", explanation: "LSM tree storage architecture." },
          { round: 3, set: "C", questionNumber: 1, title: "Two Phase Commit", correctAnswer: "Two Phase Commit", aliases: ["2PC"], points: 3, domain: "Transactions", clue1: "Prepare Phase", clue2: "Commit Phase", explanation: "Two phase distributed commit protocol." }
        ]
      };
      content = JSON.stringify(sample, null, 2);
      filename = 'tech_bridge_all_rounds_template.json';
      mime = 'application/json';
    } else {
      content = `round,set,questionNumber,correctAnswer,title,clue1,clue2,points,domain,aliases,explanation\n1,A,1,Deadlock,Deadlock Detection,Processes Waiting,Resource Lock,1,Operating Systems,Dead Lock,Operating system deadlock\n1,B,1,Cache Memory,Cache Memory,SRAM Chip,L1 L2 Cache,1,Architecture,CPU Cache,High speed CPU cache\n1,C,1,Stack Overflow,Stack Overflow,Infinite Recursion,Call Stack,1,Software,Call Stack,Call stack memory overflow\n2,A,1,Raft Consensus,Distributed Consensus,Leader Election,Log Replication,2,Distributed,Raft,Raft consensus protocol\n2,B,1,Event Streaming,Kafka Streaming,Message Queue,Pub Sub,2,Data Streams,Kafka,Event streaming broker\n2,C,1,Vector Database,Vector DB,Embeddings Space,Cosine Similarity,2,AI Systems,Vector DB,Vector database index\n3,A,1,CAP Theorem,CAP Theorem,Consistency,Availability,3,Distributed Theory,Brewer's Theorem,CAP theorem tradeoff\n3,B,1,LSM Tree,LSM Tree Engine,MemTable,SSTable,3,Databases,Log Structured Merge,LSM tree storage architecture\n3,C,1,Two Phase Commit,Two Phase Commit,Prepare Phase,Commit Phase,3,Transactions,2PC,Two phase commit protocol`;
      filename = 'tech_bridge_all_rounds_template.csv';
      mime = 'text/csv';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Validate JSON Schema against Expected Application Structure
  const handleValidateSchema = async () => {
    if (!inputText.trim()) {
      setMessage({ type: 'error', text: 'Please paste JSON or content to validate schema.' });
      return;
    }

    setValidatingSchema(true);
    setValidationData(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/questions/validate-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ content: inputText }),
      });

      const data = await res.json();
      if (res.ok) {
        setValidationData(data);
        if (data.matrix) setParsedMatrix(data.matrix);
        setMessage({
          type: data.valid ? 'success' : 'error',
          text: data.valid
            ? `Schema Validated: ${data.totalQuestions} questions strictly conform to expected structure.`
            : `Schema Alert: ${data.invalidCount} issue(s) detected across questions.`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to validate JSON schema.' });
        if (data.errors) setValidationData(data);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Validation request error: ${err.message}` });
    } finally {
      setValidatingSchema(false);
    }
  };

  // 1-Click Master Direct Insert (All Rounds & All Sets at Once)
  const handleDirectMasterInsert = async () => {
    if (!inputText.trim()) {
      setMessage({ type: 'error', text: 'Please paste or upload question document content first' });
      return;
    }

    const confirmMsg = replaceMode === 'REPLACE_ALL'
      ? 'WARNING: This will replace the ENTIRE question bank with the new questions across All Rounds and Sets. Proceed?'
      : replaceMode === 'REPLACE_MATCHING'
      ? 'This will overwrite existing questions in the matching (Round, Set) categories. Proceed?'
      : 'This will append all new questions into the question bank. Proceed?';

    if (!window.confirm(confirmMsg)) return;

    setDirectInserting(true);
    setMessage(null);

    try {
      let format = detectedFormat;
      if (format === 'AUTO') {
        format = inputText.trim().startsWith('[') || inputText.trim().startsWith('{') ? 'JSON' : 'TEXT';
      }

      const res = await fetch('/api/admin/questions/bulk-all-rounds-insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          content: inputText,
          format,
          replaceMode,
          defaultRound,
          defaultSet,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setParsedMatrix(data.matrix || null);
        setInputText('');
        onQuestionsImported();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to insert questions' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDirectInserting(false);
    }
  };

  // Staging Review Queue Parser
  const handleParseToReviewQueue = async () => {
    if (!inputText.trim()) {
      setMessage({ type: 'error', text: 'Please paste or upload document content to parse' });
      return;
    }

    setParsing(true);
    setMessage(null);

    try {
      let format = detectedFormat;
      if (format === 'AUTO') {
        format = inputText.trim().startsWith('[') || inputText.trim().startsWith('{') ? 'JSON' : 'TEXT';
      }

      const res = await fetch('/api/admin/questions/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          content: inputText,
          format,
          defaultRound,
          defaultSet,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setParsedMatrix(data.matrix || null);
        setInputText('');
        fetchQueue();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to parse questions' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setParsing(false);
    }
  };

  const handleApproveAll = async () => {
    if (queue.length === 0) return;
    try {
      const res = await fetch('/api/admin/questions/review-queue/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ itemIds: queue.map(q => q.id) }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchQueue();
        onQuestionsImported();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleClearQueue = async () => {
    if (queue.length === 0) return;
    if (!window.confirm(`Clear all ${queue.length} staged questions from the review queue?`)) return;

    try {
      const res = await fetch('/api/admin/questions/review-queue/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        fetchQueue();
        setMessage({ type: 'success', text: 'Review staging queue cleared.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/questions/review-queue/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        fetchQueue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/admin/questions/review-queue/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(editingItem),
      });
      if (res.ok) {
        setEditingItem(null);
        fetchQueue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter staged queue
  const filteredQueue = queue.filter(item => {
    if (filterRound !== 'ALL' && String(item.round) !== filterRound) return false;
    if (filterSet !== 'ALL' && item.set !== filterSet) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-tech text-[#172033] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0891B2]" />
            BULK QUESTIONS IMPORT (ALL ROUNDS & SETS)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Import questions simultaneously across <strong>Round 1, Round 2, Round 3</strong> and <strong>Sets A, B, C</strong> in one shot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueue}
            className="flex items-center gap-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033] px-3 py-2 rounded-xl text-xs font-semibold border border-[#DCE6F0] transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-2 shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="bg-[#F8FAFC] p-1.5 rounded-2xl border border-[#DCE6F0] flex flex-wrap gap-2">
        <button
          onClick={() => setImportMode('ALL_ROUNDS')}
          className={`flex-1 min-w-[220px] py-2.5 px-4 rounded-xl text-xs font-tech font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            importMode === 'ALL_ROUNDS'
              ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-md'
              : 'bg-white text-[#64748B] hover:text-[#172033] border border-[#DCE6F0]'
          }`}
        >
          <Grid className="w-4 h-4" />
          ⚡ ALL ROUNDS & ALL SETS MASTER IMPORT (1-CLICK)
        </button>

        <button
          onClick={() => setImportMode('SINGLE_TARGET')}
          className={`py-2.5 px-4 rounded-xl text-xs font-tech font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            importMode === 'SINGLE_TARGET'
              ? 'bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white shadow-md'
              : 'bg-white text-[#64748B] hover:text-[#172033] border border-[#DCE6F0]'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          Single Round / Set Target
        </button>
      </div>

      {/* Main Import Card */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl p-5 shadow-xs space-y-4">
        {/* Sub-Header & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DCE6F0]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0891B2]" />
            <span className="font-tech font-bold text-sm text-[#172033]">
              {importMode === 'ALL_ROUNDS'
                ? 'Master Import Deck (Round 1 + Round 2 + Round 3 × Sets A, B, C)'
                : 'Targeted Specific Round / Set Ingestion'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={generateAllRoundsSampleJSON}
              className="px-2.5 py-1.5 rounded-lg bg-[#ECFEFF] text-[#0891B2] border border-[#06B6D4]/30 hover:bg-[#CFFAFE] text-[11px] font-bold font-tech transition cursor-pointer flex items-center gap-1.5"
              title="Load ready-made 3-round 3-set JSON questions"
            >
              <Sparkles className="w-3 h-3" /> Load Master JSON Template
            </button>
            <button
              onClick={generateAllRoundsSampleCSV}
              className="px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] text-[#16A34A] border border-[#22C55E]/30 hover:bg-[#DCFCE7] text-[11px] font-bold font-tech transition cursor-pointer flex items-center gap-1.5"
              title="Load ready-made 3-round CSV template"
            >
              <FileText className="w-3 h-3" /> Load Master CSV
            </button>
            <button
              onClick={() => downloadTemplate('CSV')}
              className="px-2 py-1.5 rounded-lg bg-[#F8FAFC] text-[#475569] border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="Download CSV blank spreadsheet template"
            >
              <Download className="w-3 h-3" /> Blank CSV
            </button>
            <button
              onClick={() => downloadTemplate('JSON')}
              className="px-2 py-1.5 rounded-lg bg-[#F8FAFC] text-[#475569] border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="Download JSON structure template"
            >
              <Download className="w-3 h-3" /> Blank JSON
            </button>
          </div>
        </div>

        {/* Configuration Row for Target Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#DCE6F0]">
          {importMode === 'SINGLE_TARGET' ? (
            <>
              <div>
                <label className="text-[11px] font-bold text-[#475569] block mb-1">Target Round:</label>
                <select
                  value={defaultRound}
                  onChange={(e) => setDefaultRound(Number(e.target.value) as RoundNumber)}
                  className="w-full bg-white border border-[#DCE6F0] text-[#172033] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#06B6D4]"
                >
                  <option value={1}>Round 1 (Foundations - 1 pt)</option>
                  <option value={2}>Round 2 (Core Architectures - 2 pts)</option>
                  <option value={3}>Round 3 (Advanced Mastery - 3 pts)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#475569] block mb-1">Target Set:</label>
                <select
                  value={defaultSet}
                  onChange={(e) => setDefaultSet(e.target.value as QuestionSet)}
                  className="w-full bg-white border border-[#DCE6F0] text-[#172033] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#06B6D4]"
                >
                  <option value="A">Set A (First Batch)</option>
                  <option value="B">Set B (Second Batch)</option>
                  <option value="C">Set C (Third Batch)</option>
                </select>
              </div>
            </>
          ) : (
            <div className="md:col-span-2 flex items-center gap-2 text-xs text-[#0891B2] bg-[#ECFEFF] px-3 py-2 rounded-lg border border-[#06B6D4]/20">
              <Grid className="w-4 h-4 shrink-0" />
              <span>
                <strong>All-Rounds Auto-Detect Active:</strong> The parser will dynamically map questions into Round 1, 2, 3 and Sets A, B, C based on file tags or CSV columns.
              </span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-[#475569] block mb-1">Insertion Policy:</label>
            <select
              value={replaceMode}
              onChange={(e) => setReplaceMode(e.target.value as any)}
              className="w-full bg-white border border-[#DCE6F0] text-[#172033] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#06B6D4]"
            >
              <option value="APPEND">Append to Existing Questions</option>
              <option value="REPLACE_MATCHING">Replace Matching Round & Sets</option>
              <option value="REPLACE_ALL">Overwrite Entire Question Bank</option>
            </select>
          </div>
        </div>

        {/* Input Text Area */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-[#475569]">Document Content / Data Stream:</span>
            <span className="text-[10px] text-[#94A3B8]">Supports JSON with multi-round array, CSV spreadsheets, or structured text</span>
          </div>
          <textarea
            rows={8}
            placeholder={`Paste all questions here or upload a file. 
Supported formats:
1. JSON with questions array containing "round": 1/2/3 and "set": "A"/"B"/"C"
2. CSV with headers: round,set,questionNumber,correctAnswer,title,clue1,clue2,points,domain,aliases,explanation
3. Text with section headers:
=== ROUND 1 - SET A ===
Question 1: Operating System deadlock condition
Answer: Deadlock
Points: 1

=== ROUND 2 - SET B ===
Question 1: Apache Kafka real-time streaming
Answer: Event Streaming
Points: 2`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-3 text-xs font-mono-code text-[#172033] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#06B6D4]"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033] px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#DCE6F0] cursor-pointer transition">
            <Upload className="w-3.5 h-3.5 text-[#0891B2]" />
            Upload File (CSV, JSON, TXT)
            <input type="file" accept=".txt,.json,.csv" onChange={handleFileUpload} className="hidden" />
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={handleValidateSchema}
              disabled={validatingSchema || !inputText.trim()}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-tech font-bold px-3.5 py-2.5 rounded-xl text-xs border border-emerald-300 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              {validatingSchema ? 'Validating...' : 'Validate JSON Schema'}
            </button>

            <button
              onClick={handleParseToReviewQueue}
              disabled={parsing || directInserting || validatingSchema}
              className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033] font-tech font-bold px-4 py-2.5 rounded-xl text-xs border border-[#DCE6F0] flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <ListFilter className="w-3.5 h-3.5 text-[#0891B2]" />
              {parsing ? 'Parsing...' : 'Parse to Review Queue'}
            </button>

            <button
              onClick={handleDirectMasterInsert}
              disabled={directInserting || parsing || validatingSchema}
              className="bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#1D4ED8] text-white font-tech font-bold px-5 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              {directInserting ? 'Inserting All...' : '⚡ INSERT ALL TO QUESTION BANK (1-CLICK)'}
            </button>
          </div>
        </div>

        {/* Validation Diagnostic Panel */}
        {validationData && (
          <div
            className={`p-4 rounded-xl border ${
              validationData.valid
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                : 'bg-rose-50/70 border-rose-300 text-rose-900'
            } space-y-2`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono font-bold text-xs">
                {validationData.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {validationData.valid
                    ? `✓ JSON SCHEMA VALIDATION PASSED (${validationData.totalQuestions} Questions Structure Approved)`
                    : `⚠ SCHEMA WARNINGS / ERRORS DETECTED (${validationData.invalidCount} flagged / ${validationData.totalQuestions} questions)`}
                </span>
              </div>
              <div className="text-[11px] font-mono font-bold">
                Valid: <span className="text-emerald-700">{validationData.validCount}</span> | Invalid: <span className="text-rose-700">{validationData.invalidCount}</span>
              </div>
            </div>

            {validationData.errors && validationData.errors.length > 0 && (
              <div className="pt-2 border-t border-rose-200 text-xs font-mono">
                <div className="font-bold text-rose-800 mb-1">Detailed Diagnostic Errors:</div>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {validationData.errors.map((err, i) => (
                    <div key={i} className="text-[11px] text-rose-700">
                      • Item #{err.index + 1} {err.questionNumber ? `(Q#${err.questionNumber})` : ''}: {err.field ? `[${err.field}] ` : ''}{err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Matrix Summary if available */}
        {parsedMatrix && (
          <div className="bg-[#ECFEFF]/60 border border-[#06B6D4]/30 rounded-xl p-4 mt-3">
            <div className="text-xs font-bold font-tech text-[#0891B2] mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              CURRENT QUESTION BANK MATRIX DISTRIBUTION:
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-[#06B6D4]/20 shadow-xs">
                <div className="text-[11px] font-tech font-bold text-[#172033]">ROUND 1 (1 pt)</div>
                <div className="text-xs font-mono-code text-[#475569] mt-1">
                  Set A: <strong className="text-[#0891B2]">{parsedMatrix.round1?.A || 0}</strong> | Set B: <strong className="text-[#0891B2]">{parsedMatrix.round1?.B || 0}</strong> | Set C: <strong className="text-[#0891B2]">{parsedMatrix.round1?.C || 0}</strong>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#06B6D4]/20 shadow-xs">
                <div className="text-[11px] font-tech font-bold text-[#172033]">ROUND 2 (2 pts)</div>
                <div className="text-xs font-mono-code text-[#475569] mt-1">
                  Set A: <strong className="text-[#0891B2]">{parsedMatrix.round2?.A || 0}</strong> | Set B: <strong className="text-[#0891B2]">{parsedMatrix.round2?.B || 0}</strong> | Set C: <strong className="text-[#0891B2]">{parsedMatrix.round2?.C || 0}</strong>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#06B6D4]/20 shadow-xs">
                <div className="text-[11px] font-tech font-bold text-[#172033]">ROUND 3 (3 pts)</div>
                <div className="text-xs font-mono-code text-[#475569] mt-1">
                  Set A: <strong className="text-[#0891B2]">{parsedMatrix.round3?.A || 0}</strong> | Set B: <strong className="text-[#0891B2]">{parsedMatrix.round3?.B || 0}</strong> | Set C: <strong className="text-[#0891B2]">{parsedMatrix.round3?.C || 0}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Queue Deck */}
      <div className="bg-white border border-[#DCE6F0] rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-[#F8FAFC] px-5 py-3.5 border-b border-[#DCE6F0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-tech font-bold text-sm text-[#172033] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0891B2]" />
              Staged Review Queue ({queue.length} Total Questions)
            </span>

            {/* Filter controls */}
            <div className="flex items-center gap-1.5">
              <select
                value={filterRound}
                onChange={(e) => setFilterRound(e.target.value)}
                className="bg-white border border-[#DCE6F0] text-[#172033] rounded-lg px-2 py-1 text-[11px] focus:outline-none"
              >
                <option value="ALL">All Rounds</option>
                <option value="1">Round 1</option>
                <option value="2">Round 2</option>
                <option value="3">Round 3</option>
              </select>

              <select
                value={filterSet}
                onChange={(e) => setFilterSet(e.target.value)}
                className="bg-white border border-[#DCE6F0] text-[#172033] rounded-lg px-2 py-1 text-[11px] focus:outline-none"
              >
                <option value="ALL">All Sets</option>
                <option value="A">Set A</option>
                <option value="B">Set B</option>
                <option value="C">Set C</option>
              </select>
            </div>
          </div>

          {queue.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearQueue}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
              >
                Clear Queue
              </button>
              <button
                onClick={handleApproveAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-tech font-bold px-4 py-1.5 rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Approve & Commit All ({queue.length})
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-[#DCE6F0] max-h-[500px] overflow-y-auto">
          {filteredQueue.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B]">
              {queue.length === 0 
                ? 'Review queue is empty. Paste or upload question documents above to stage questions or click "INSERT ALL TO QUESTION BANK" for 1-click master import.'
                : 'No questions match the current Round/Set filter.'}
            </div>
          ) : (
            filteredQueue.map((item) => (
              <div key={item.id} className="p-4 hover:bg-[#F8FAFC] transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-[#172033]">Q{item.questionNumber}: {item.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#ECFEFF] text-[#0891B2] border border-[#06B6D4]/30 text-[11px] font-tech font-bold">
                      Round {item.round} • Set {item.set}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-tech">
                      {item.domain} • {item.points} pts
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        item.confidence === 'HIGH'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Confidence: {item.confidence}
                    </span>
                  </div>

                  <div className="text-xs text-[#172033] bg-[#F8FAFC] p-2.5 rounded-xl border border-[#DCE6F0] flex flex-wrap gap-4 font-mono-code">
                    <div>
                      Answer: <strong className="text-emerald-700">"{item.correctAnswer}"</strong>
                    </div>
                    {item.aliases && item.aliases.length > 0 && (
                      <div>
                        Accepted Aliases: <span className="text-[#64748B]">[{item.aliases.join(', ')}]</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="p-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033] border border-[#DCE6F0] transition cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                    title="Reject Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE6F0] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold font-tech text-[#172033] flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#0891B2]" />
              EDIT STAGED QUESTION
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#172033] font-medium block mb-1">Round</label>
                  <select
                    value={editingItem.round}
                    onChange={(e) => setEditingItem({ ...editingItem, round: Number(e.target.value) as RoundNumber })}
                    className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-2 text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  >
                    <option value={1}>Round 1</option>
                    <option value={2}>Round 2</option>
                    <option value={3}>Round 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#172033] font-medium block mb-1">Set</label>
                  <select
                    value={editingItem.set}
                    onChange={(e) => setEditingItem({ ...editingItem, set: e.target.value as QuestionSet })}
                    className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-2 text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#172033] font-medium block mb-1">Title / Prompt</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-2.5 text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#172033] font-medium block mb-1">Correct Answer</label>
                  <input
                    type="text"
                    value={editingItem.correctAnswer}
                    onChange={(e) => setEditingItem({ ...editingItem, correctAnswer: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-2.5 text-[#172033] font-mono-code focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
                <div>
                  <label className="text-[#172033] font-medium block mb-1">Points</label>
                  <input
                    type="number"
                    value={editingItem.points}
                    onChange={(e) => setEditingItem({ ...editingItem, points: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-2.5 text-[#172033] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#172033] font-medium block mb-1">Aliases (comma separated)</label>
                <input
                  type="text"
                  value={(editingItem.aliases || []).join(', ')}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full bg-[#F8FAFC] border border-[#DCE6F0] rounded-xl p-2.5 text-[#172033] font-mono-code focus:outline-none focus:border-[#06B6D4]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#DCE6F0]">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F1F5F9] text-[#172033] hover:bg-[#E2E8F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold font-tech bg-gradient-to-r from-[#06B6D4] to-[#2563EB] text-white hover:from-[#0891B2] hover:to-[#1D4ED8] cursor-pointer shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
