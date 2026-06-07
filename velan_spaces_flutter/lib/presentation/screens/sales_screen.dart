import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/domain/entities/lead_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/lead_providers.dart';

class SalesScreen extends ConsumerStatefulWidget {
  const SalesScreen({super.key});

  @override
  ConsumerState<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends ConsumerState<SalesScreen> {
  String _statusFilter = 'all';

  static const _statusOrder = [
    'new',
    'contacted',
    'site_visit',
    'proposal_sent',
    'won',
    'lost',
  ];

  static const _statusLabels = {
    'new': 'New',
    'contacted': 'Contacted',
    'site_visit': 'Site Visit',
    'proposal_sent': 'Proposal Sent',
    'won': 'Won',
    'lost': 'Lost',
  };

  static const _statusColors = {
    'new': Color(0xFF3B82F6),
    'contacted': Color(0xFF8B5CF6),
    'site_visit': Color(0xFFF59E0B),
    'proposal_sent': Color(0xFFEC4899),
    'won': Color(0xFF22C55E),
    'lost': Color(0xFFEF4444),
  };

  static const _sourceIcons = {
    'instagram': Icons.camera_alt,
    'whatsapp': Icons.chat,
    'referral': Icons.people,
    'website': Icons.language,
    'other': Icons.more_horiz,
  };

  @override
  Widget build(BuildContext context) {
    final leadsAsync = ref.watch(allLeadsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Sales'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'sales_fab',
        onPressed: () => _showAddLeadDialog(),
        label: const Text('New Lead',
            style: TextStyle(fontWeight: FontWeight.bold)),
        icon: const Icon(Icons.person_add),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // ─── Status Filter Chips ────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _buildFilterChip('all', 'All'),
                  ..._statusOrder.map((s) =>
                      _buildFilterChip(s, _statusLabels[s] ?? s)),
                ],
              ),
            ),
          ),

          // ─── Stats Row ─────────────────────────────────
          leadsAsync.when(
            data: (leads) {
              final newCount =
                  leads.where((l) => l.status == 'new').length;
              final activeCount = leads
                  .where((l) =>
                      l.status != 'won' &&
                      l.status != 'lost' &&
                      l.status != 'new')
                  .length;
              final wonCount =
                  leads.where((l) => l.status == 'won').length;

              return Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    _buildStatCard(
                        'New', newCount, const Color(0xFF3B82F6)),
                    const SizedBox(width: 8),
                    _buildStatCard(
                        'Active', activeCount, const Color(0xFFF59E0B)),
                    const SizedBox(width: 8),
                    _buildStatCard(
                        'Won', wonCount, const Color(0xFF22C55E)),
                  ],
                ),
              );
            },
            loading: () => const SizedBox(height: 80),
            error: (_, __) => const SizedBox(height: 80),
          ),

          // ─── Lead List ─────────────────────────────────
          Expanded(
            child: leadsAsync.when(
              data: (leads) {
                final filtered = _statusFilter == 'all'
                    ? leads
                    : leads
                        .where((l) => l.status == _statusFilter)
                        .toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_search,
                            size: 64, color: Colors.grey.shade300),
                        const SizedBox(height: 16),
                        Text(
                          _statusFilter == 'all'
                              ? 'No leads yet'
                              : 'No ${_statusLabels[_statusFilter]} leads',
                          style: TextStyle(
                              fontSize: 16, color: Colors.grey.shade600),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Tap + to add your first lead',
                          style: TextStyle(
                              fontSize: 14, color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final lead = filtered[index];
                    return _buildLeadCard(lead);
                  },
                );
              },
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (err, _) =>
                  Center(child: Text('Error: $err')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String value, String label) {
    final isSelected = _statusFilter == value;
    final color = value == 'all'
        ? Colors.black
        : _statusColors[value] ?? Colors.grey;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : color,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
        selected: isSelected,
        onSelected: (_) => setState(() => _statusFilter = value),
        backgroundColor: color.withOpacity(0.08),
        selectedColor: color,
        checkmarkColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: color.withOpacity(0.2)),
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Text(
              count.toString(),
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLeadCard(LeadEntity lead) {
    final statusColor = _statusColors[lead.status] ?? Colors.grey;
    final sourceIcon =
        _sourceIcons[lead.source.toLowerCase()] ?? Icons.more_horiz;

    return Dismissible(
      key: ValueKey(lead.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.red.shade400,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Delete Lead?'),
                content: const Text('This cannot be undone.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel')),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style:
                        TextButton.styleFrom(foregroundColor: Colors.red),
                    child: const Text('Delete'),
                  ),
                ],
              ),
            ) ??
            false;
      },
      onDismissed: (_) {
        ref.read(leadControllerProvider.notifier).deleteLead(lead.id);
      },
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        elevation: 1,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showLeadDetail(lead),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Avatar
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: statusColor.withOpacity(0.12),
                      child: Text(
                        lead.clientName.isNotEmpty
                            ? lead.clientName[0].toUpperCase()
                            : '?',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lead.clientName,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          if (lead.projectType.isNotEmpty)
                            Text(
                              lead.projectType,
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.grey.shade600,
                              ),
                            ),
                        ],
                      ),
                    ),
                    // Status Badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusLabels[lead.status] ?? lead.status,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (lead.area.isNotEmpty) ...[
                      Icon(Icons.location_on_outlined,
                          size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        lead.area,
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                      const SizedBox(width: 16),
                    ],
                    if (lead.source.isNotEmpty) ...[
                      Icon(sourceIcon,
                          size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        lead.source,
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                      const SizedBox(width: 16),
                    ],
                    if (lead.estimatedBudget.isNotEmpty) ...[
                      Icon(Icons.account_balance_wallet_outlined,
                          size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        '₹${lead.estimatedBudget}',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                    const Spacer(),
                    if (lead.createdAt != null)
                      Text(
                        DateFormat('dd MMM').format(lead.createdAt!),
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade400),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ─── Lead Detail Bottom Sheet ──────────────────────────────────────────

  void _showLeadDetail(LeadEntity lead) {
    final statusColor = _statusColors[lead.status] ?? Colors.grey;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // Header
                Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: statusColor.withOpacity(0.12),
                      child: Text(
                        lead.clientName.isNotEmpty
                            ? lead.clientName[0].toUpperCase()
                            : '?',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lead.clientName,
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              _statusLabels[lead.status] ?? lead.status,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: statusColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Status Pipeline
                const Text('Update Status',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _statusOrder.map((s) {
                    final isActive = lead.status == s;
                    final color = _statusColors[s] ?? Colors.grey;

                    return ChoiceChip(
                      label: Text(
                        _statusLabels[s] ?? s,
                        style: TextStyle(
                          color: isActive ? Colors.white : color,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                      selected: isActive,
                      selectedColor: color,
                      backgroundColor: color.withOpacity(0.08),
                      onSelected: (_) {
                        ref
                            .read(leadControllerProvider.notifier)
                            .updateLeadStatus(lead.id, s);
                        Navigator.pop(context);
                      },
                    );
                  }).toList(),
                ),

                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 16),

                // Details
                if (lead.clientPhone.isNotEmpty)
                  _buildDetailRow(Icons.phone, 'Phone', lead.clientPhone),
                if (lead.area.isNotEmpty)
                  _buildDetailRow(
                      Icons.location_on_outlined, 'Area', lead.area),
                if (lead.projectType.isNotEmpty)
                  _buildDetailRow(
                      Icons.category_outlined, 'Type', lead.projectType),
                if (lead.source.isNotEmpty)
                  _buildDetailRow(
                      Icons.source_outlined, 'Source', lead.source),
                if (lead.estimatedBudget.isNotEmpty)
                  _buildDetailRow(Icons.account_balance_wallet_outlined,
                      'Budget', '₹${lead.estimatedBudget}'),
                if (lead.notes.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Notes',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 6),
                  Text(
                    lead.notes,
                    style: TextStyle(
                        fontSize: 14, color: Colors.grey.shade700),
                  ),
                ],

                const SizedBox(height: 24),

                // Convert to Project button (only for 'won' status)
                if (lead.status == 'won')
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                                'Project conversion coming soon — create project manually and reference this lead.'),
                          ),
                        );
                      },
                      icon: const Icon(Icons.rocket_launch),
                      label: const Text('Convert to Project'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF22C55E),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade500),
          const SizedBox(width: 12),
          Text(
            '$label: ',
            style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Add Lead Dialog ───────────────────────────────────────────────────

  void _showAddLeadDialog() {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final areaController = TextEditingController();
    final typeController = TextEditingController();
    final budgetController = TextEditingController();
    final notesController = TextEditingController();
    String selectedSource = 'referral';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setBottomState) => Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const Text(
                    'New Lead',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 20),
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Client Name *',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: phoneController,
                    decoration: const InputDecoration(
                      labelText: 'Phone',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: areaController,
                    decoration: const InputDecoration(
                      labelText: 'Area / Location',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.location_on_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: typeController,
                    decoration: const InputDecoration(
                      labelText: 'Project Type / Requirement',
                      hintText:
                          'e.g. Living Room, Full Home, Office, Kitchen',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selectedSource,
                    decoration: const InputDecoration(
                      labelText: 'Lead Source',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.source_outlined),
                    ),
                    items: const [
                      DropdownMenuItem(
                          value: 'instagram', child: Text('Instagram')),
                      DropdownMenuItem(
                          value: 'whatsapp', child: Text('WhatsApp')),
                      DropdownMenuItem(
                          value: 'referral', child: Text('Referral')),
                      DropdownMenuItem(
                          value: 'website', child: Text('Website')),
                      DropdownMenuItem(
                          value: 'other', child: Text('Other')),
                    ],
                    onChanged: (v) =>
                        setBottomState(() => selectedSource = v!),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: budgetController,
                    decoration: const InputDecoration(
                      labelText: 'Estimated Budget',
                      hintText: 'e.g. 5L - 10L',
                      border: OutlineInputBorder(),
                      prefixIcon:
                          Icon(Icons.account_balance_wallet_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: notesController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Notes',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.notes_outlined),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (!formKey.currentState!.validate()) return;
                        Navigator.pop(ctx);
                        await ref
                            .read(leadControllerProvider.notifier)
                            .addLead(
                              clientName: nameController.text.trim(),
                              clientPhone: phoneController.text.trim(),
                              area: areaController.text.trim(),
                              projectType: typeController.text.trim(),
                              source: selectedSource,
                              estimatedBudget:
                                  budgetController.text.trim(),
                              notes: notesController.text.trim(),
                            );
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Lead added')),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text(
                        'Add Lead',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
