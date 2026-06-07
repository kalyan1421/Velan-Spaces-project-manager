import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/portfolio_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/portfolio_providers.dart';

class WebsiteScreen extends ConsumerStatefulWidget {
  const WebsiteScreen({super.key});

  @override
  ConsumerState<WebsiteScreen> createState() => _WebsiteScreenState();
}

class _WebsiteScreenState extends ConsumerState<WebsiteScreen> {
  String _statusFilter = 'all';

  static const _statusLabels = {
    'draft': 'Draft',
    'published': 'Published',
    'hidden': 'Hidden',
  };

  static const _statusColors = {
    'draft': Color(0xFFF59E0B),
    'published': Color(0xFF22C55E),
    'hidden': Color(0xFF6B7280),
  };

  static const _categoryLabels = {
    'residential': 'Residential',
    'commercial': 'Commercial',
    'office': 'Office',
    'kitchen': 'Kitchen',
    'other': 'Other',
  };

  @override
  Widget build(BuildContext context) {
    final portfolioAsync = ref.watch(allPortfolioProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Website'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'website_fab',
        onPressed: () => _showAddPortfolioSheet(),
        label: const Text('Add Project',
            style: TextStyle(fontWeight: FontWeight.bold)),
        icon: const Icon(Icons.add_photo_alternate),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // ─── Status Filter ─────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _buildFilterChip('all', 'All'),
                  _buildFilterChip('published', 'Published'),
                  _buildFilterChip('draft', 'Drafts'),
                  _buildFilterChip('hidden', 'Hidden'),
                ],
              ),
            ),
          ),

          // ─── Stats ─────────────────────────────────────
          portfolioAsync.when(
            data: (items) {
              final published =
                  items.where((i) => i.status == 'published').length;
              final drafts =
                  items.where((i) => i.status == 'draft').length;

              return Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    _buildStatCard('Published', published,
                        const Color(0xFF22C55E)),
                    const SizedBox(width: 8),
                    _buildStatCard(
                        'Drafts', drafts, const Color(0xFFF59E0B)),
                    const SizedBox(width: 8),
                    _buildStatCard(
                        'Total', items.length, VelanTheme.primaryDark),
                  ],
                ),
              );
            },
            loading: () => const SizedBox(height: 80),
            error: (_, __) => const SizedBox(height: 80),
          ),

          // ─── Portfolio Grid ────────────────────────────
          Expanded(
            child: portfolioAsync.when(
              data: (items) {
                final filtered = _statusFilter == 'all'
                    ? items
                    : items
                        .where((i) => i.status == _statusFilter)
                        .toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.web_outlined,
                            size: 64, color: Colors.grey.shade300),
                        const SizedBox(height: 16),
                        Text(
                          _statusFilter == 'all'
                              ? 'No portfolio items'
                              : 'No ${_statusLabels[_statusFilter]} items',
                          style: TextStyle(
                              fontSize: 16, color: Colors.grey.shade600),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Tap + to showcase your first project',
                          style: TextStyle(
                              fontSize: 14, color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ),
                  );
                }

                return GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 0.75,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    return _buildPortfolioCard(filtered[index]);
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
        padding: const EdgeInsets.symmetric(vertical: 12),
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
              style:
                  TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPortfolioCard(PortfolioEntity item) {
    final statusColor = _statusColors[item.status] ?? Colors.grey;

    return Card(
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showPortfolioDetail(item),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cover image placeholder
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.08),
                  image: item.coverImageUrl.isNotEmpty
                      ? DecorationImage(
                          image: NetworkImage(item.coverImageUrl),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: item.coverImageUrl.isEmpty
                    ? Center(
                        child: Icon(
                          Icons.image_outlined,
                          size: 40,
                          color: statusColor.withOpacity(0.4),
                        ),
                      )
                    : null,
              ),
            ),
            // Info
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.projectName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _statusLabels[item.status] ?? item.status,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: statusColor,
                          ),
                        ),
                        if (item.category.isNotEmpty) ...[
                          const Spacer(),
                          Text(
                            _categoryLabels[item.category] ??
                                item.category,
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Portfolio Detail ──────────────────────────────────────────────────

  void _showPortfolioDetail(PortfolioEntity item) {
    final statusColor = _statusColors[item.status] ?? Colors.grey;

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

                // Title and status
                Text(
                  item.projectName,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusLabels[item.status] ?? item.status,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                    if (item.category.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _categoryLabels[item.category] ?? item.category,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 24),

                // Visibility Controls
                const Text('Visibility',
                    style: TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 12),
                Row(
                  children: ['published', 'draft', 'hidden'].map((s) {
                    final isActive = item.status == s;
                    final color = _statusColors[s] ?? Colors.grey;

                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: ElevatedButton(
                          onPressed: () {
                            ref
                                .read(portfolioControllerProvider.notifier)
                                .updateStatus(item.id, s);
                            Navigator.pop(context);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isActive
                                ? color
                                : color.withOpacity(0.08),
                            foregroundColor:
                                isActive ? Colors.white : color,
                            elevation: isActive ? 2 : 0,
                            padding: const EdgeInsets.symmetric(
                                vertical: 10),
                          ),
                          child: Text(
                            _statusLabels[s] ?? s,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 16),

                // Details
                if (item.location.isNotEmpty)
                  _buildDetailRow(Icons.location_on_outlined,
                      'Location', item.location),
                if (item.completionYear.isNotEmpty)
                  _buildDetailRow(Icons.calendar_today_outlined,
                      'Completed', item.completionYear),
                if (item.description.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Case Study',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 6),
                  Text(
                    item.description,
                    style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade700,
                        height: 1.5),
                  ),
                ],

                const SizedBox(height: 24),

                // Delete button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _confirmDelete(item.id, item.projectName);
                    },
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('Remove from Portfolio'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 12),
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
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(String id, String name) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove from Portfolio?'),
        content:
            Text('Remove "$name" from the website portfolio?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref
                  .read(portfolioControllerProvider.notifier)
                  .delete(id);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }

  // ─── Add Portfolio Sheet ───────────────────────────────────────────────

  void _showAddPortfolioSheet() {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController();
    final locationController = TextEditingController();
    final yearController = TextEditingController();
    final descController = TextEditingController();
    String selectedCategory = 'residential';

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
                    'Add to Portfolio',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 20),
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Project Name *',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selectedCategory,
                    decoration: const InputDecoration(
                      labelText: 'Category',
                      border: OutlineInputBorder(),
                    ),
                    items: _categoryLabels.entries
                        .map((e) => DropdownMenuItem(
                            value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) =>
                        setBottomState(() => selectedCategory = v!),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: locationController,
                    decoration: const InputDecoration(
                      labelText: 'Location',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: yearController,
                    decoration: const InputDecoration(
                      labelText: 'Completion Year',
                      hintText: 'e.g. 2024',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: descController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Case Study / Description',
                      border: OutlineInputBorder(),
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
                            .read(
                                portfolioControllerProvider.notifier)
                            .addPortfolioItem(
                              projectName: nameController.text.trim(),
                              category: selectedCategory,
                              location:
                                  locationController.text.trim(),
                              completionYear:
                                  yearController.text.trim(),
                              description: descController.text.trim(),
                            );
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('Added to portfolio')),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        padding:
                            const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text(
                        'Add to Portfolio',
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
